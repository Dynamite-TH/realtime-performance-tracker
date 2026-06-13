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
    connectedClients.push(ws);

    ws.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== ws);
    });
});

app.post('/api/metrics', (req, res) => {
    const { timestamp, cpuUsage, memory, disk, system_uptime } = req.body || {};

    // Validate the data quickly so we don't process garbage data
    if (cpuUsage === undefined || memory === undefined || disk === undefined) {
        return res.status(400).json({ error: 'Missing required metric fields' });
    }

    const stringifiedData = JSON.stringify(req.body);
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(stringifiedData);
        }
    });

    // console.log(cpuUsage, memory.memoryUsage, disk.diskUsage, timestamp)
    // Acknowledge receipt to the Agent immediately with a 202 Accepted status
    // 202 means: "We received it and are processing it, no need to wait around."
    res.status(202).send({ status: 'Metrics logged and broadcasted' });
});


// Start the unified server on port 3030
server.listen(3030, () => {
    console.log('Ingestion server listening on port 3030');
});