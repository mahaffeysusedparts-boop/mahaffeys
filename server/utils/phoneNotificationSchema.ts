export const notificationSchema = `
  CREATE TABLE IF NOT EXISTS push_server_keys (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton), public_key TEXT NOT NULL, private_key TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS phone_notification_rules (
    action TEXT PRIMARY KEY, recipient_ids JSONB NOT NULL, operator_ids JSONB NOT NULL
  );
  CREATE TABLE IF NOT EXISTS phone_push_devices (
    endpoint_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS phone_push_devices_user_idx ON phone_push_devices(user_id);
`;
