import path from 'path';
import { fileURLToPath } from 'url';
import express, { json } from 'express';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import PDFDocument from 'pdfkit';



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

app.get('/api/reports/download-24h', async (req, res) => {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 24 * 60 * 60 * 1000);

    try {
        const { rows } = await pool.query(
            `SELECT
                hourly_bucket,
                record_count,
                avg_cpu,
                max_cpu,
                avg_memory,
                avg_disk,
                avg_uptime
            FROM server_health_hourly_avg
            WHERE hourly_bucket >= $1 AND hourly_bucket < $2
            ORDER BY hourly_bucket ASC`,
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

        res.setHeader('Content-Disposition', 'attachment; filename="system-performance-report-24h.pdf"');
        res.setHeader('Content-Type', 'application/pdf');

        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        doc.fontSize(20).fillColor('#0f172a').text('24-Hour System Performance Report', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(10).fillColor('#475569').text(`Report range: ${startTime.toISOString()} to ${endTime.toISOString()}`, { align: 'center' });
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

        doc.y = summaryTop + 122;
        doc.moveDown(1);

        if (rows.length === 0) {
            doc.fontSize(12).fillColor('#1d4ed8').text('No data was found for the last 24 hours.');
        } else {

            const startX = 40;
            const colWidths = [112, 55, 65, 65, 70, 65, 70];
            const headers = ['Hour', 'Samples', 'Avg CPU', 'Max CPU', 'Avg Memory', 'Avg Disk', 'Avg Uptime'];

            let currentY = doc.y;
            const drawRow = (values, isHeader = false) => {
                let x = startX;
                const rowHeight = 22;

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
                    new Date(row.hourly_bucket).toISOString().slice(0, 13).replace('T', ' '),
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

// Start the unified server on port 3030
server.listen(3030, () => {
    console.log('Ingestion server listening on port 3030');
});