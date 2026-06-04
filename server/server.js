const express = require('express');
const http = require('http');
const WebSocket = require('ws');


const app = express();
app.use(express.json()); // Middleware to parse incoming JSON payloads

// 2. Setup HTTP & WebSocket Server together
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Track connected frontend clients
let connectedClients = [];
wss.on('connection', (ws) => {
    connectedClients.push(ws);

    ws.on('close', () => {
        connectedClients = connectedClients.filter(client => client !== ws);
    });
});

app.post('/api/metrics', (req, res) => {
    const { timestamp, cpuUsage, memoryUsagePercentage, system_uptime } = req.body || {};

    // Validate the data quickly so we don't process garbage data
    if (cpuUsage === undefined || memoryUsagePercentage === undefined) {
        return res.status(400).json({ error: 'Missing required metric fields' });
    }

    const stringifiedData = JSON.stringify(req.body);
    connectedClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(stringifiedData);
        }
    });
    const uptimeDays = Math.floor(system_uptime / (60 * 60 * 24));
    const uptimeHours = Math.floor((system_uptime % (60 * 60 * 24)) / (60 * 60));
    const uptimeMinutes = Math.floor((system_uptime % (60 * 60)) / 60);
    const uptimeSeconds = Math.floor(system_uptime % 60);
    const uptime = `${uptimeDays} Days, ${uptimeHours} hours, ${uptimeMinutes} minutes, ${uptimeSeconds} seconds`
    console.log(cpuUsage, memoryUsagePercentage, timestamp, uptime)
    // Acknowledge receipt to the Agent immediately with a 202 Accepted status
    // 202 means: "We received it and are processing it, no need to wait around."
    res.status(202).send({ status: 'Metrics logged and broadcasted' });
});


// Start the unified server on port 3000
server.listen(3000, () => {
    console.log('Ingestion server listening on port 3000');
});