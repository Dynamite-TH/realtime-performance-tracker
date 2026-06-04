const os = require('os');
const { cpuUsage } = require('process');

let URL = 'http://localhost:3000/api/metrics'

const interval = 2000 // 18000 seconds / 30 mins

function cpuIdle() {
    const cpus = os.cpus();
    let totalMs = 0;
    let idleMs = 0;

    cpus.forEach((core) => {
        for (type in core.times) {
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

const intervalId = setInterval(async () => {
    const cpuUsage = await getCpuUsage()
    let totalMemory = os.totalmem()
    let freeMemory = os.freemem()
    const memoryUsage = (100 - ((freeMemory / totalMemory) * 100))
    const uptime = os.uptime()
    console.log(`Total Number of memory used: ${memoryUsage}%, total cpu usage ${cpuUsage}%, Taken at ${new Date()}`);


    (async () => {
        try {
            const response = await fetch(URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    timestamp: new Date(),
                    cpuUsage: cpuUsage, // set to 0 for now while implementation is being done
                    memoryUsagePercentage: memoryUsage,
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
