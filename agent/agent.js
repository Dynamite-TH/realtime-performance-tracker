import { cpus as _cpus, totalmem, freemem, uptime as _uptime } from 'os';
import { statfs } from 'node:fs/promises';
const API_BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3030';
const URL = process.env.API_URL || `${API_BASE_URL}/api/metrics`

const interval = 2000
const HOUR_MS = 60 * 60 * 1000;
let isPostingQueue = false;

function cpuIdle() {
    const cpus = _cpus();
    let totalMs = 0;
    let idleMs = 0;

    cpus.forEach((core) => {
        for (let type in core.times) {
            totalMs += core.times[type];
        }
        idleMs += core.times.idle;
    });

    return { totalMs, idleMs };
}

function getCpuUsage() {
    return new Promise((resolve) => {
        const start = cpuIdle();

        setTimeout(() => {
            const end = cpuIdle();

            const idle = end.idleMs - start.idleMs;
            const total = end.totalMs - start.totalMs;

            // Calculate the percentage of time the CPU was NOT idle
            const cpuPercentage = (1 - idle / total) * 100;

            resolve(Number(cpuPercentage)); // Format to 2 decimal places
        }, 100); // 100ms sample window
    });
}



async function getDiskavailable() {
    const stats = await statfs('/');
    return stats.bsize * stats.bavail;
}

async function getDiskSize() {
    const stats = await statfs('/');
    return stats.bsize * stats.blocks
}
const diskSize = await getDiskSize()
const totalMemory = totalmem()
let localQueue = [];


const getMsUntilNextHour = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setMinutes(0, 0, 0);
    nextHour.setHours(nextHour.getHours() + 1);
    return nextHour.getTime() - now.getTime();
};

const flushQueue = async () => {
    if (isPostingQueue || localQueue.length === 0) {
        return;
    }

    isPostingQueue = true;
    try {
        const queueToSend = localQueue;
        const response = await fetch(URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(queueToSend)
        })
        if (response?.ok) {
            localQueue = [];
        }
    } finally {
        isPostingQueue = false;
    }
};

const startHourlyQueueFlush = () => {
    const delay = getMsUntilNextHour();
    setTimeout(async () => {
        await flushQueue();
        setInterval(flushQueue, HOUR_MS);
    }, delay);
};

startHourlyQueueFlush()

const intervalId = setInterval(async () => {
    const cpuUsage = await getCpuUsage()

    const diskavailable = await getDiskavailable()
    const diskUsage = (1 - diskavailable / diskSize) * 100

    const freeMemory = freemem()
    const memoryUsage = (100 - ((freeMemory / totalMemory) * 100))

    const uptime = _uptime()
    console.log(`Total Number of memory used: ${memoryUsage}%, total cpu usage ${cpuUsage}%, available bytes ${diskavailable}, total bytes ${diskSize}, storage used ${diskUsage}%, Taken at ${new Date()}`);

    let payload = {
        timestamp: new Date(),
        cpuPercent: cpuUsage,
        memory: { totalMemory: totalMemory, freeMemory: freeMemory, memoryUsage: memoryUsage },
        memoryPercent: memoryUsage,
        disk: { diskUsage: diskUsage, diskSize: diskSize },
        diskPercent: diskUsage,
        system_uptime: uptime
    };

    console.log(payload)
    localQueue.push(payload)

    // Stream most recent metric in real-time
    try {
        console.log(`Queue size: ${localQueue.length}, Time until flush: ${getMsUntilNextHour()}ms`)
        await fetch(`${API_BASE_URL}/api/metrics/ws`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })
    } catch (e) {
        console.error('Error streaming metric:', e.message);
    }

    // Maintain queue size limit
    if (localQueue.length >= 3600) {
        localQueue.shift();
        console.warn('Queue limit reached! Dropped oldest metric.');
    }


}, interval);
