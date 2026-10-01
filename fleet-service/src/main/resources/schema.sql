-- Recommended composite index for Alert queries on vehicle_id and created_at DESC
CREATE INDEX IF NOT EXISTS idx_alert_vehicle_created ON alerts (vehicle_id, created_at DESC);

-- Partial index for open/unresolved alerts
CREATE INDEX IF NOT EXISTS idx_alert_open ON alerts (vehicle_id, subsystem) WHERE resolved_at IS NULL;


