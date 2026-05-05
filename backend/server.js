require('dotenv').config();
const fastify = require('fastify')({ logger: false });
const Redis = require('ioredis');
const { Pool } = require('pg');
const mongoose = require('mongoose');
const retry = require('async-retry');

// --- 1. CONFIGURATION ---
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_URL = process.env.DATABASE_URL;
const REDIS_URL = process.env.REDIS_URL;

const redis = new Redis(REDIS_URL);
const pgPool = new Pool({
    connectionString: DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

// --- 2. WAIT FOR POSTGRES ---
const waitForPostgres = async () => {
    await retry(async () => {
        const client = await pgPool.connect();
        await client.query('SELECT 1');
        client.release();
        console.log('✅ PostgreSQL Connected');
    }, {
        retries: 10,
        minTimeout: 2000,
        onRetry: (err) => console.log('⏳ Waiting for PostgreSQL...', err.message)
    });
};

// --- 3. SCHEMA INITIALIZATION ---
const initDb = async () => {
    let client;
    try {
        client = await pgPool.connect();
        console.log("📡 Initializing PostgreSQL schema...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS incidents (
                id SERIAL PRIMARY KEY,
                component_id VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'OPEN',
                severity VARCHAR(10),
                start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                end_time TIMESTAMP,
                mttr_minutes FLOAT
            );
        `);
        await client.query(`
            CREATE TABLE IF NOT EXISTS rcas (
                id SERIAL PRIMARY KEY,
                incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
                category VARCHAR(100),
                fix_applied TEXT,
                prevention_steps TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ PostgreSQL Schema Ready");
    } catch (err) {
        console.error("❌ Schema Init Failed:", err.message);
        throw err;
    } finally {
        if (client) client.release();
    }
};

// --- 4. MONGODB CONNECTION ---
retry(async () => {
    console.log("Attempting to connect to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Data Lake (MongoDB) Connected");
}, {
    retries: 10,
    minTimeout: 2000,
    onRetry: (err) => console.log('⏳ Waiting for MongoDB...', err.message)
});

// --- 5. DATA ARCHITECTURE ---
const Signal = mongoose.model('Signal', new mongoose.Schema({
    component_id: String,
    severity: String,
    payload: Object,
    received_at: { type: Date, default: Date.now },
    incident_id: String
}));

// --- 6. MIDDLEWARE ---
fastify.register(require('@fastify/rate-limit'), {
    max: 10000,
    timeWindow: '1 minute'
});
fastify.register(require('@fastify/cors'), {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// --- 7. DESIGN PATTERNS ---
const AlertStrategies = {
    P0: (inc) => console.log(`🚨 [STRATEGY: PAGERDUTY] Critical Page for ${inc.component_id}`),
    P1: (inc) => console.log(`⚠️ [STRATEGY: SLACK] Alerting #ops-channel for ${inc.component_id}`),
    P2: (inc) => console.log(`ℹ️ [STRATEGY: JIRA] Creating ticket for ${inc.component_id}`)
};

const VALID_TRANSITIONS = {
    'OPEN': ['INVESTIGATING', 'CLOSED'],
    'INVESTIGATING': ['IDENTIFIED', 'CLOSED'],
    'IDENTIFIED': ['CLOSED'],
    'CLOSED': ['OPEN']
};

// --- 8. INGESTION ENGINE ---
let signalBuffer = [];
const BUFFER_LIMIT = 100000;
let throughputCounter = 0;
let historyMetrics = [];

fastify.post('/ingest', async (request, reply) => {
    const signalData = request.body;
    throughputCounter++;
    if (signalBuffer.length >= BUFFER_LIMIT) {
        return reply.code(503).send({ error: 'Backpressure: Buffer Full' });
    }
    signalBuffer.push({ ...signalData, received_at: new Date() });
    return { status: 'buffered' };
});

const drainBuffer = async () => {
    if (signalBuffer.length === 0) return;
    const batch = [...signalBuffer];
    signalBuffer = [];
    let client;
    try {
        client = await pgPool.connect();
        for (const signal of batch) {
            const cacheKey = `active_incident:${signal.component_id}`;
            let incidentId = await redis.get(cacheKey);
            if (!incidentId) {
                const res = await client.query(
                    'INSERT INTO incidents (component_id, severity, status) VALUES ($1, $2, $3) RETURNING id',
                    [signal.component_id, signal.severity || 'P2', 'OPEN']
                );
                incidentId = res.rows[0].id;
                await redis.set(cacheKey, incidentId, 'EX', 10);
                const strategy = AlertStrategies[signal.severity] || AlertStrategies.P2;
                strategy(signal);
            }
            await Signal.create({ ...signal, incident_id: incidentId });
        }
    } catch (err) {
        console.error('❌ Database Batch Error:', err.message);
    } finally {
        if (client) client.release();
    }
};
setInterval(drainBuffer, 1000);

// --- 9. ROUTES ---

// Health check
fastify.get('/health', async () => ({ status: 'healthy' }));

// Graph data - severity distribution
fastify.get('/analytics/throughput', async () => {
    const res = await pgPool.query(`
        SELECT severity, COUNT(*) as count
        FROM incidents
        GROUP BY severity
        ORDER BY severity
    `);
    return res.rows.map(r => ({ severity: r.severity, count: parseInt(r.count) }));
});

// Active incidents
fastify.get('/incidents', async () => {
    const res = await pgPool.query(`
        SELECT i.*, r.category, r.fix_applied,
        CASE WHEN i.end_time IS NOT NULL
             THEN EXTRACT(EPOCH FROM (i.end_time - i.start_time))/60
             ELSE NULL END as mttr_minutes
        FROM incidents i
        LEFT JOIN rcas r ON i.id = r.incident_id
        WHERE i.status != 'CLOSED'
        ORDER BY i.start_time DESC
    `);
    return res.rows;
});

// History - MUST be before /:id routes
fastify.get('/incidents/history', async () => {
    const res = await pgPool.query(`
        SELECT i.*, r.category, r.fix_applied,
        EXTRACT(EPOCH FROM (i.end_time - i.start_time))/60 as mttr_minutes
        FROM incidents i
        LEFT JOIN rcas r ON i.id = r.incident_id
        WHERE i.status = 'CLOSED'
        ORDER BY i.start_time DESC
    `);
    return res.rows;
});

// Audit logs per incident
fastify.get('/incidents/:id/logs', async (request) => {
    const { id } = request.params;
    return await Signal.find({ incident_id: String(id) })
        .sort({ received_at: -1 })
        .limit(100);
});

// State transitions and RCA
fastify.post('/incidents/:id/transition', async (request, reply) => {
    const { id } = request.params;
    const { newStatus, rcaData } = request.body;

    const current = await pgPool.query(
        'SELECT status, start_time FROM incidents WHERE id = $1', [id]
    );
    if (current.rows.length === 0) {
        return reply.code(404).send({ error: 'Not found' });
    }
    if (!VALID_TRANSITIONS[current.rows[0].status]?.includes(newStatus)) {
        return reply.code(400).send({ error: 'Illegal State Transition' });
    }

    if (newStatus === 'CLOSED') {
        const fixDetails = rcaData?.fix_applied || rcaData?.fixApplied;
        const category = rcaData?.category || 'System Failure';
        if (!fixDetails) {
            return reply.code(400).send({ error: 'MANDATORY RCA: Fix details required.' });
        }
        const mttr = (new Date() - new Date(current.rows[0].start_time)) / (1000 * 60);
        await pgPool.query(
            'UPDATE incidents SET status=$1, end_time=CURRENT_TIMESTAMP, mttr_minutes=$2 WHERE id=$3',
            [newStatus, mttr, id]
        );
        await pgPool.query(
            'INSERT INTO rcas (incident_id, category, fix_applied) VALUES ($1, $2, $3)',
            [id, category, fixDetails]
        );
    } else {
        await pgPool.query(
            'UPDATE incidents SET status=$1 WHERE id=$2', [newStatus, id]
        );
    }
    return { success: true };
});

// --- 10. OBSERVABILITY ---
setInterval(() => {
    const currentTps = throughputCounter / 5;
    historyMetrics.push({
        time: new Date().toLocaleTimeString(),
        tps: currentTps
    });
    if (historyMetrics.length > 50) historyMetrics.shift();
    throughputCounter = 0;
    console.log(`[METRICS] Throughput: ${currentTps} signals/sec`);
}, 5000);

// --- 11. STARTUP ---
const start = async () => {
    try {
        await waitForPostgres();
        await initDb();
        await fastify.listen({ port: 3000, host: '0.0.0.0' });
        console.log("🚀 Resilient IMS Engine Online");
    } catch (err) {
        console.error("Startup Error:", err);
        process.exit(1);
    }
};
start();
