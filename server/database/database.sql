CREATE TABLE server_health (
    time TIMESTAMPTZ NOT NULL,
    server_id VARCHAR(50) NOT NULL, 
    cpu_usage DOUBLE PRECISION,
    memory_percentage DOUBLE PRECISION
);


SELECT create_hypertable('server_health', 'time');

CREATE MATERIALIZED VIEW server_health_hourly_avg
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS hourly_bucket,
    server_id,
    AVG(cpu_usage) AS avg_cpu,
    MAX(cpu_usage) AS max_cpu,
    AVG(memory_percentage) AS avg_memory
FROM server_health
GROUP BY hourly_bucket, server_id;

SELECT add_continuous_aggregate_policy('server_health_hourly_avg',
    start_offset => INTERVAL '8 days',
    end_offset => INTERVAL '1 hour',      
    schedule_interval => INTERVAL '1 hour' 
);

SELECT add_retention_policy('server_health', INTERVAL '7 days');