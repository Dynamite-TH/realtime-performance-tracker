import express, { json } from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';


const app = express();
app.use(json()); // Middleware to parse incoming JSON payloads

// 2. Setup HTTP & WebSocket Server together
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

app.post('/api/metrics', (req, res) => {
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    // Validate the data quickly so we don't process garbage data
    for (const payload of payloads) {
        const { timestamp, cpuUsage, memory, disk, system_uptime } = payload || {};
        if (cpuUsage === undefined || memory === undefined || disk === undefined) {
            return res.status(400).json({ error: 'Missing required metric fields' });
        }

        // Broadcast this single payload (not the entire req.body)
        const stringifiedData = JSON.stringify(payload);
        connectedClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(stringifiedData);
                } catch (e) {
                    // ignore individual send errors; client will be removed on close
                }
            }
        });
    }
    // console.log(cpuUsage, memory.memoryUsage, disk.diskUsage, timestamp)
    // Acknowledge receipt to the Agent immediately with a 202 Accepted status
    // 202 means: "We received it and are processing it, no need to wait around."
    res.status(202).send({ status: 'Metrics logged and broadcasted' });
});


// Start the unified server on port 3030
server.listen(3030, () => {
    console.log('Ingestion server listening on port 3030');
});