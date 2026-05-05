const axios = require('axios');

const API_URL = 'http://localhost:3000/ingest';
const TOTAL_SIGNALS = 10000;
const BATCH_SIZE = 100; 
const API_KEY = 'zeotap_sre_2026_secret'; // Matches the Docker environment key

const components = ['DATABASE-CLUSTER', 'AUTH-SERVICE', 'PROD_API_GATEWAY', 'PAYMENT-WORKER'];
const severities = ['P0', 'P1', 'P2'];

async function sendBatch(batchNum) {
    const promises = [];
    for (let i = 0; i < BATCH_SIZE; i++) {
        const payload = {
            component_id: components[Math.floor(Math.random() * components.length)],
            severity: severities[Math.floor(Math.random() * severities.length)],
            message: `Simulated high-load signal #${batchNum * BATCH_SIZE + i}`,
            timestamp: new Date().toISOString()
        };
        // Adding the Security Header
        promises.push(axios.post(API_URL, payload, { 
            headers: { 'x-api-key': API_KEY } 
        }).catch(e => {
            if(e.response && e.response.status === 429) console.log("Rate limit hit!");
        }));
    }
    await Promise.all(promises);
    console.log(`Sent batch ${batchNum + 1}/${TOTAL_SIGNALS / BATCH_SIZE}`);
}

async function runTest() {
    console.log("🚀 Starting 10k Signal Stress Test...");
    const start = Date.now();
    for (let i = 0; i < TOTAL_SIGNALS / BATCH_SIZE; i++) {
        await sendBatch(i);
    }
    const duration = (Date.now() - start) / 1000;
    console.log(`✅ Test Complete! Rate: ${Math.round(TOTAL_SIGNALS / duration)} signals/sec`);
}

runTest();
