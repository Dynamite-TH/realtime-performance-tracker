const os = require('os');

const interval = 1800000 // 18000 seconds / 30 mins

setInterval(() => {
    let totalMemory = os.totalmem()
    let freeMemory = os.freemem()
    const memoryUsage = 100 - ((freeMemory / totalMemory) * 100)
    console.log(`Total Number of memory used: ${memoryUsage.toFixed(2)}% taken every ${60000 / 1000} seconds`)
    
}, 60000);