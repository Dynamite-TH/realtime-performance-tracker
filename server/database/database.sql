CREATE TABLE server_health (
    time TIMESTAMPTZ NOT NULL,
    cpu_usage DOUBLE PRECISION,
    memory_percentage DOUBLE PRECISION
);

SELECT create_hypertable('server_health', 'time');

CREATE MATERIALIZED VIEW server_health_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hourly_bucket,
    AVG(cpu_usage) AS avg_cpu,
    AVG(memory_percentage) AS avg_memory
FROM server_health
GROUP BY hourly_bucket;

SELECT add_continuous_aggregate_policy('server_health_hourly_avg',
    start_offset => INTERVAL '3 hours',  -- How far back to check for new/delayed raw data
    end_offset => INTERVAL '1 hour',     -- Don't aggregate the current, active hour yet
    schedule_interval => INTERVAL '1 hour' -- Run this maintenance window every hour
);

SELECT add_retention_policy('server_health', INTERVAL '7 days');