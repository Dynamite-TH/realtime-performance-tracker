const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsUrl = `${protocol}://localhost:3030`;

const connectionStatus = document.getElementById('connectionStatus');
const cpuUsageEl = document.getElementById('cpuUsage');
const memoryUsageEl = document.getElementById('memoryUsage');
const memoryCardEl = document.getElementById('memoryCard');
const diskUsageEl = document.getElementById('diskUsage');
const diskCardEl = document.getElementById('diskCard');
const uptimeEl = document.getElementById('uptime');
const timestampEl = document.getElementById('timestamp');
const retry = document.getElementById('retry')
document.getElementById('wsUrl').textContent = wsUrl;

const maxReconnectAttempts = 5;
let reconnectAttempts = 0;

let showMemoryFreeOverTotal = false;
let latestFreeMemory = null;
let latestTotalMemory = null;
let showDiskUsedOverTotal = false;
let latestDiskUsage = null;
let latestDiskSize = null;

function formatPercent(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) return '--';
    return `${value.toFixed(2)}%`;
}

function formatBytes(bytes) {
    if (typeof bytes !== 'number' || Number.isNaN(bytes)) return '--';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
}

function renderMemoryUsage() {
    if (typeof latestFreeMemory !== 'number' || typeof latestTotalMemory !== 'number') {
        memoryUsageEl.textContent = '--';
        return;
    }

    if (!showMemoryFreeOverTotal) {
        const memoryUsage = 100 - (latestFreeMemory / latestTotalMemory) * 100;
        memoryUsageEl.textContent = formatPercent(memoryUsage);
        return;
    }
    const usedMemory = latestTotalMemory - latestFreeMemory;
    memoryUsageEl.textContent = `${formatBytes(usedMemory)} / ${formatBytes(latestTotalMemory)}`;
}

function renderDiskUsage() {
    if (typeof latestDiskUsage !== 'number' || typeof latestDiskSize !== 'number') {
        diskUsageEl.textContent = '--';
        return;
    }

    if (!showDiskUsedOverTotal) {
        diskUsageEl.textContent = formatPercent(latestDiskUsage);
        return;
    }

    const usedBytes = latestDiskSize * (latestDiskUsage / 100);
    diskUsageEl.textContent = `${formatBytes(usedBytes)} / ${formatBytes(latestDiskSize)}`;
}

function uptimeFormat(system_uptime) {
    const uptimeHours = Math.floor(system_uptime / (60 * 60));
    const uptimeMinutes = Math.floor((system_uptime % (60 * 60)) / 60);
    const uptimeSeconds = Math.floor(system_uptime % 60);
    const uptime = `${uptimeHours} hrs, ${uptimeMinutes} mins, ${uptimeSeconds} secs`
    return uptime
}

diskCardEl.addEventListener('click', () => {
    showDiskUsedOverTotal = !showDiskUsedOverTotal;
    renderDiskUsage();
});

memoryCardEl.addEventListener('click', () => {
    showMemoryFreeOverTotal = !showMemoryFreeOverTotal;
    renderMemoryUsage();
});

retry.addEventListener('click', () => {
    retry.hidden = true;
    connectionStatus.textContent = 'Manually Connecting...'
    connect();
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registered!', reg))
            .catch(err => console.err('Service Worker registration failed', err));
    });
}


function connect() {
    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
        reconnectAttempts = 0;
        connectionStatus.textContent = 'Connected';
    });

    socket.addEventListener('message', (event) => {
        const data = JSON.parse(event.data);

        cpuUsageEl.textContent = formatPercent(data.cpuUsage);
        latestFreeMemory = data.memory?.freeMemory;
        latestTotalMemory = data.memory?.totalMemory;
        renderMemoryUsage();

        latestDiskUsage = data.disk?.diskUsage;
        latestDiskSize = data.disk?.diskSize;
        renderDiskUsage();
        const uptime = (uptimeFormat(data.system_uptime))
        uptimeEl.textContent = uptime;
        timestampEl.textContent = data.timestamp
            ? new Date(data.timestamp).toLocaleString()
            : '--';
    });

    socket.addEventListener('close', () => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            connectionStatus.textContent = 'Disconnected: Retry limit reached. Server Offline';
            retry.hidden = false;
            socket.close()
            return;
        }

        reconnectAttempts += 1;
        connectionStatus.textContent = `Disconnected, retrying (${reconnectAttempts}/${maxReconnectAttempts})...`;
        setTimeout(connect, 2000);
    });

    socket.addEventListener('error', () => {
        connectionStatus.textContent = 'Connection error';
        socket.close();
    });
}


connect();