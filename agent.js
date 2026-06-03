const os = require('os');

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
    console.log(`Total Number of memory used: ${memoryUsage.toFixed(2)}% taken every ${2000 / 1000} seconds, Taken at ${time()}`)

}, interval);




function runHourlyTask() {
    console.log(`Hourly task fired at ${new Date().toISOString()}`)
}

function scheduleHourly(task) {
    const now = new Date()
    const next = new Date(now)
    next.setHours(now.getHours() + 1, 0, 0, 0)
    const msToNextHour = next - now

    if (msToNextHour === 0) { // started exactly on the hour -> run now then every hour
        task()
        setInterval(task, 60 * 60 * 1000)
    } else {
        setTimeout(() => {
            task()
            setInterval(task, 60 * 60 * 1000)
        }, msToNextHour)
    }
}

scheduleHourly(runHourlyTask)
