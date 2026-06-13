import { cpus as _cpus, totalmem, freemem, uptime as _uptime } from 'os';
import { statfs } from 'node:fs/promises';

let URL = 'http://localhost:3030/api/metrics'

const interval = 2000 // 18000 seconds / 30 mins

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

const intervalId = setInterval(async () => {
    const cpuUsage = await getCpuUsage()

    const diskavailable = await getDiskavailable()
    const diskUsage = (1 - diskavailable / diskSize) * 100

    const freeMemory = freemem()
    const memoryUsage = (100 - ((freeMemory / totalMemory) * 100))

    const uptime = _uptime()
    console.log(`Total Number of memory used: ${memoryUsage}%, total cpu usage ${cpuUsage}%, avaialble bytes ${diskUsage}, total bytes ${diskSize}, storage used ${diskUsage}%, Taken at ${new Date()}, `);


    (async () => {
        try {
            const response = await fetch(URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    timestamp: new Date(),
                    cpuUsage: cpuUsage,
                    memory: { totalMemory: totalMemory, freeMemory: freeMemory, memoryUsage: memoryUsage },
                    disk: { diskUsage: diskUsage, diskSize: diskSize, diskUsage: diskUsage },
                    system_uptime: uptime

                })
            })

            if (!response.ok) {
                console.error(`Server responded with status ${response.status}; stopping metrics interval.`)
                clearInterval(intervalId)
                return
            }

            console.log(`Metrics sent with status ${response.status}`)
        } catch (e) {
            console.error('Error sending metrics; stopping interval.', e)
            clearInterval(intervalId)
        }
    })()

}, interval);
