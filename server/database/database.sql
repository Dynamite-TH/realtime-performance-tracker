CREATE TABLE IF NOT EXISTS server_health (
    time TIMESTAMPTZ NOT NULL,
    cpu_usage DOUBLE PRECISION,
    memory_usage_percent DOUBLE PRECISION,
    disk_usage_percent DOUBLE PRECISION,
    system_uptime_seconds DOUBLE PRECISION,
    data_samples INT
);
