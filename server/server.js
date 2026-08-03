import path from 'path';
import { fileURLToPath } from 'url';
import express, { json } from 'express';
import fs from 'fs';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import PDFDocument from 'pdfkit';



// dotenv file reader (prefer Docker / environment variables)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load local config.env only if DB_HOST isn't provided (so containers supply DB creds)
try {
    if (!process.env.DB_HOST) {
        const envPath = path.join(__dirname, 'config.env');
        if (fs.existsSync(envPath)) {
            dotenv.config({ path: envPath });
        }
    }
} catch (e) {
    // ignore and continue with process.env
}
// end of file reader
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
app.use(json({ limit: '5mb' })); // Middleware to parse incoming JSON payloads

// Serve client static files when present (so the app container can serve the UI)
const clientDir = path.join(__dirname, '..', 'client');
if (fs.existsSync(clientDir)) {
    app.use((req, res, next) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        next();
    });
    app.use(express.static(clientDir));
    app.get('/', (req, res) => res.sendFile(path.join(clientDir, 'index.html')));
}

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

function aggregateQueueMetrics(queueArray) {
    if (!Array.isArray(queueArray) || queueArray.length === 0) return null;
    const len = queueArray.length;
    const sums = {
        timestamp: 0,
        cpuPercent: 0,
        memoryPercent: 0,
        diskPercent: 0,
        system_uptime: 0
    };

    for (let i = 0; i < len; i++) {
        const item = queueArray[i] || {};
        const ts = item.timestamp ? new Date(item.timestamp).getTime() : Date.now();
        sums.timestamp += ts;
        sums.cpuPercent += Number(item.cpuPercent || 0);
        sums.memoryPercent += Number(item.memoryPercent || 0);
        sums.diskPercent += Number(item.diskPercent || 0);
        sums.system_uptime += Number(item.system_uptime || 0);
    }

    return {
        timestamp: new Date(Math.round(sums.timestamp / len)).toISOString(),
        cpuPercent: Number((sums.cpuPercent / len).toFixed(2)),
        memoryPercent: Number((sums.memoryPercent / len).toFixed(2)),
        diskPercent: Number((sums.diskPercent / len).toFixed(2)),
        system_uptime: Number((sums.system_uptime / len).toFixed(2))
    };
}

async function sendErrorAlert(subject, message) {
    const mailOptions = {
        from: `"Server Monitor" <${process.env.ICLOUD_EMAIL}>`,
        to: process.env.ICLOUD_EMAIL, // Sending to yourself
        subject: `🚨 Server Alert: ${subject}`,
        text: message,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Alert email sent successfully:', info.messageId);
    } catch (error) {
        console.error('Failed to send alert email:', error);
    }
}

app.post('/api/metrics', async (req, res) => {
    const payloads = Array.isArray(req.body) ? req.body : [req.body];

    try {

        const aggregated = aggregateQueueMetrics(payloads);
        await pool.query(
            `INSERT INTO server_health (
                    time,
                    cpu_usage,
                    memory_usage_percent,
                    disk_usage_percent,
                    system_uptime_seconds
                ) VALUES ($1, $2, $3, $4, $5)`,
            [
                aggregated.timestamp ? new Date(aggregated.timestamp) : new Date(),
                aggregated.cpuPercent,
                aggregated.memoryPercent,
                aggregated.diskPercent,
                aggregated.system_uptime
            ]
        );

        return res.status(202).json({ status: 'Metrics stored and broadcasted' });
    } catch (error) {
        console.error('DB insert failed:', error);
        return res.status(500).json({ error: 'Failed to save metrics' });
    }
});


app.post('/api/metrics/ws', async (req, res) => {
    const payload = Array.isArray(req.body) ? req.body.at(-1) : req.body;

    try {
        if (!payload) {
            return res.status(400).json({ error: 'Missing metric payload' });
        }

        const stringifiedData = JSON.stringify(payload);
        connectedClients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(stringifiedData);
            }
        });

        return res.status(202).json({ status: 'Metrics stored and broadcasted' });
    } catch (error) {
        console.error('ws unable to stream data:', error);
        return res.status(500).json({ error: 'Failed to stream metrics' });
    }
});

app.get('/api/reports/download-24h', async (req, res) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);
    const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const formatLocalDateTime = (value) => {
        const date = new Date(value);
        const parts = new Intl.DateTimeFormat('en-CA', {
            timeZone: deviceTimeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        }).formatToParts(date);

        const asMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
        return `${asMap.year}-${asMap.month}-${asMap.day} ${asMap.hour}:${asMap.minute}:${asMap.second}`;
    };

    const formatLocalHour = (value) => formatLocalDateTime(value).slice(0, 13);

    try {
        const { rows } = await pool.query(
            `SELECT
                date_trunc('hour', time) AS hourly_bucket,
                COUNT(*) AS record_count,
                AVG(cpu_usage) AS avg_cpu,
                MAX(cpu_usage) AS max_cpu,
                AVG(memory_usage_percent) AS avg_memory,
                AVG(disk_usage_percent) AS avg_disk,
                AVG(system_uptime_seconds) AS avg_uptime
            FROM server_health
            WHERE time >= $1 AND time < $2
            GROUP BY hourly_bucket
            ORDER BY hourly_bucket DESC`,
            [startTime, endTime]
        );

        const totals = rows.reduce(
            (acc, row) => {
                const sampleCount = Number(row.record_count) || 0;
                const avgCpu = Number(row.avg_cpu) || 0;
                const avgMemory = Number(row.avg_memory) || 0;
                const avgDisk = Number(row.avg_disk) || 0;

                acc.samples += sampleCount;
                acc.cpuSum += avgCpu * sampleCount;
                acc.memorySum += avgMemory * sampleCount;
                acc.diskSum += avgDisk * sampleCount;
                acc.maxCpu = Math.max(acc.maxCpu, Number(row.max_cpu) || 0);
                return acc;
            },
            { samples: 0, cpuSum: 0, memorySum: 0, diskSum: 0, maxCpu: 0 }
        );

        const overallAvgCpu = totals.samples ? totals.cpuSum / totals.samples : 0;
        const overallAvgMemory = totals.samples ? totals.memorySum / totals.samples : 0;
        const overallAvgDisk = totals.samples ? totals.diskSum / totals.samples : 0;

        const reportDate = new Date().toISOString().split('T')[0];

        res.setHeader('Content-Disposition', `attachment; filename="system-performance-report-${reportDate}.pdf"`);
        res.setHeader('Content-Type', 'application/pdf');

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        doc.fontSize(20).fillColor('#0f172a').text('24-Hour System Performance Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#475569').text(`Report range: ${formatLocalDateTime(startTime)} to ${formatLocalDateTime(endTime)} (${deviceTimeZone})`, { align: 'center' });
        doc.moveDown(1.5);

        doc.fontSize(12).fillColor('#0f172a').text('Summary');
        doc.moveDown(0.5);
        const summaryTop = doc.y;
        const cards = [
            ['Samples', String(totals.samples)],
            ['Average CPU', `${overallAvgCpu.toFixed(2)}%`],
            ['Maximum CPU', `${totals.maxCpu.toFixed(2)}%`],
            ['Average Memory', `${overallAvgMemory.toFixed(2)}%`],
            ['Average Disk', `${overallAvgDisk.toFixed(2)}%`],
        ];

        cards.forEach((card, index) => {
            const x = 40 + (index % 2) * 250;
            const y = summaryTop + Math.floor(index / 2) * 54;
            doc.roundedRect(x, y, 230, 44, 8).stroke('#cbd5e1');
            doc.fontSize(9).fillColor('#64748b').text(card[0], x + 12, y + 9, { width: 206 });
            doc.fontSize(15).fillColor('#0f172a').text(card[1], x + 12, y + 22, { width: 206 });
        });

        const summaryRows = Math.ceil(cards.length / 2);
        const summaryBottom = summaryTop + ((summaryRows - 1) * 54) + 44;
        doc.y = summaryBottom + 24;
        doc.moveDown(1);

        if (rows.length === 0) {
            doc.fontSize(12).fillColor('#1d4ed8').text('No data was found for the last 24 hours.');
        } else {
            doc.fontSize(12).fillColor('black').text('Data from last 24 hours', {
                align: 'center'
            });
            const startX = 40;
            const colWidths = [112, 55, 65, 65, 70, 65, 70];
            const headers = ['Hour', 'Samples', 'Avg CPU Usage', 'Max CPU Usage', 'Avg Memory Usage', 'Avg Disk Usage', 'Avg Uptime'];

            let currentY = doc.y;
            const drawRow = (values, isHeader = false) => {
                let x = startX;
                const rowHeight = 30;

                values.forEach((value, i) => {
                    doc.rect(x, currentY, colWidths[i], rowHeight).stroke('#cbd5e1');
                    doc.fontSize(isHeader ? 9 : 8.5)
                        .fillColor(isHeader ? '#0f172a' : '#1f2937')
                        .text(String(value), x + 4, currentY + 6, { width: colWidths[i] - 8, ellipsis: true });
                    x += colWidths[i];
                });

                currentY += rowHeight;
            };

            drawRow(headers, true);
            rows.forEach((row) => {
                drawRow([
                    formatLocalHour(row.hourly_bucket),
                    Number(row.record_count) || 0,
                    Number(row.avg_cpu).toFixed(2),
                    Number(row.max_cpu).toFixed(2),
                    Number(row.avg_memory).toFixed(2),
                    Number(row.avg_disk).toFixed(2),
                    Number(row.avg_uptime).toFixed(2),
                ]);
            });
        }

        doc.end();
        return;
    } catch (err) {
        console.error('Failed to generate 24-hour report:', err);
        return res.status(500).send('Internal Server Error Generating Report');
    }
});

app.use((err, req, res, next) => {
    if (err?.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload too large. Reduce batch size or increase server limit.' });
    }
    return next(err);
});


const bindAddress = process.env.BIND_ADDRESS || '0.0.0.0'; // Docker default
const port = 3030;
server.listen(port, bindAddress, () => {
    console.log(`Ingestion server listening on http://${bindAddress}:${port} (SSH tunnel only)`);
});