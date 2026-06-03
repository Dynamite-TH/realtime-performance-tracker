const os = require('os');

let URL = 'http://localhost:3000/api/metrics'

const interval = 2000 // 18000 seconds / 30 mins

function time() {
    const date = new Date()
    const seconds = date.getSeconds()
    const minutes = date.getMinutes()
    const hour = date.getHours()
    const day = date.getDay()

    return `${day}:${hour}:${minutes}:${seconds}`

}

setInterval(() => {
    let totalMemory = os.totalmem()
    let freeMemory = os.freemem()
    const memoryUsage = 100 - ((freeMemory / totalMemory) * 100)
    console.log(`Total Number of memory used: ${memoryUsage.toFixed(2)}% taken every ${2000 / 1000} seconds, Taken at ${time()}`);

    (async () => {
        try {
            const response = await fetch(URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    timestamp: new Date(),
                    cpuUsage: 0, // set to 0 for now while implimentation is being done
                    memoryUsagePercentage: memoryUsage
                })
            })
            console.log(`Metrics sent with status ${response.status}`)
        } catch (e) {
            console.log(e)
        }
    })()

}, interval);
