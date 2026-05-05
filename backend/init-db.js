const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

const init = async () => {
  try {
    await client.connect();
    console.log("📡 Connected to Postgres for schema initialization...");

    // Create the Incidents table
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

    // Create the RCA table
    await client.query(`
      CREATE TABLE IF NOT EXISTS rcas (
        id SERIAL PRIMARY KEY,
        incident_id INTEGER REFERENCES incidents(id) ON DELETE CASCADE,
        category VARCHAR(100),
        fix_applied TEXT,
        prevention_steps TEXT
      );
    `);

    console.log("✅ Postgres Tables Created Successfully");
  } catch (err) {
    console.error("❌ Initialization Failed:", err.message);
  } finally {
    await client.end();
  }
};

init();
