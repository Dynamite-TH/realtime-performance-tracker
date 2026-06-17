import path from 'path';
import { fileURLToPath } from 'url';
import express, { json } from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// dotenv file reade
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, 'config.env') });
//end of file reader

// postgres login details
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_DATABASE,
});
// console.log(typeof process.env.DB_PASSWORD, process.env.DB_PASSWORD);
const app = express();
app.use(json()); // Middleware to parse incoming JSON payloads

// creation of server and websocket
const server = createServer(app);
const wss = new WebSocketServer({ server });

// Track connected frontend clients
let connectedClients = [];
wss.on('connection', (ws) => {
    // Keep a reference so we can broadcast to active clients
    connectedClients.push(ws);
    console.log(`New frontend client connected. Total clients: ${wss.clients.size}`)

    ws.on('close', () => {
        // Remove from our local list when the socket closes
        connectedClients = connectedClients.filter(c => c !== ws);
        console.log(`Client disconnected. Total clients: ${wss.clients.size}`);
    });
});

app.post('/api/metrics', async (req, res) => {
    const payloads = Array.isArray(req.body) ? req.body : [req.body];

    try {
        for (const payload of payloads) {
            const { timestamp, cpuUsage, memory, disk, system_uptime } = payload || {};

            if (cpuUsage === undefined || memory === undefined || disk === undefined) {
                return res.status(400).json({ error: 'Missing required metric fields' });
            }

            await pool.query(
                `INSERT INTO server_health (
                    time,
                    cpu_usage,
                    memory_total_bytes,
                    memory_free_bytes,
                    memory_usage_percent,
                    disk_size_bytes,
                    disk_usage_percent,
                    system_uptime_seconds
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    timestamp ? new Date(timestamp) : new Date(),
                    cpuUsage,
                    memory.totalMemory,
                    memory.freeMemory,
                    memory.memoryUsage,
                    disk.diskSize,
                    disk.diskUsage,
                    system_uptime
                ]
            );

            const stringifiedData = JSON.stringify(payload);
            connectedClients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(stringifiedData);
                }
            });
        }

        return res.status(202).json({ status: 'Metrics stored and broadcasted' });
    } catch (error) {
        console.error('DB insert failed:', error);
        return res.status(500).json({ error: 'Failed to save metrics' });
    }
});


// Start the unified server on port 3030
server.listen(3030, () => {
    console.log('Ingestion server listening on port 3030');
});