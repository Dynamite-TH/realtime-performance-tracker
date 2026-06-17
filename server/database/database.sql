CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS server_health (
    time TIMESTAMPTZ NOT NULL,
    cpu_usage DOUBLE PRECISION,
    memory_total_bytes BIGINT,
    memory_free_bytes BIGINT,
    memory_usage_percent DOUBLE PRECISION,
    disk_size_bytes BIGINT,
    disk_usage_percent DOUBLE PRECISION,
    system_uptime_seconds DOUBLE PRECISION
);

SELECT create_hypertable('server_health', 'time', if_not_exists => TRUE);

CREATE MATERIALIZED VIEW IF NOT EXISTS server_health_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hourly_bucket,
    AVG(cpu_usage) AS avg_cpu,
    MAX(cpu_usage) AS max_cpu,
    AVG(memory_usage_percent) AS avg_memory,
    AVG(disk_usage_percent) AS avg_disk,
    AVG(system_uptime_seconds) AS avg_uptime
FROM server_health
GROUP BY hourly_bucket;

SELECT add_continuous_aggregate_policy('server_health_hourly_avg',
    start_offset => INTERVAL '8 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
);

SELECT add_retention_policy('server_health', INTERVAL '7 days');