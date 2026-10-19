'use strict';
const http = require('http');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
const PORT = parseInt(process.env.PORT || '3000', 10);
const STUDENT_ID = process.env.STUDENT_ID || 'YOUR_STUDENT_ID'; // Set your ID here or via env

if (!DATABASE_URL || !DATABASE_URL.includes('sslmode=require')) {
    console.error('[FATAL] DATABASE_URL is missing or lacks ?sslmode=require parameter.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000
});

const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (req.method === 'GET' && req.url === '/api/audit') {
        let client;
        try {
            client = await pool.connect();
            const result = await client.query(
                'SELECT log_id, student_id, tracking_code, hub_region, recorded_at FROM shipment_logs WHERE student_id = $1 ORDER BY log_id DESC;',
                [STUDENT_ID]
            );

            res.writeHead(200);
            return res.end(JSON.stringify({
                student_id: STUDENT_ID,
                paas_environment: "production",
                db_connection_pooled: true,
                ssl_enforced: true,
                total_records: result.rowCount,
                records: result.rows
            }, null, 2));
        } catch (err) {
            console.error('[QUERY_FAILURE]', err.code, err.message);
            res.writeHead(500);
            return res.end(JSON.stringify({ error: 'Database query failed', code: err.code }));
        } finally {
            if (client) client.release();
        }
    }

    res.writeHead(404);
    return res.end(JSON.stringify({ error: 'Route Not Found' }));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[STARTUP] Server bound to 0.0.0.0:${PORT}`);
});

// Graceful Shutdown
const gracefulShutdown = async (signal) => {
    server.close(async () => {
        await pool.end();
        process.exit(0);
    });
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));