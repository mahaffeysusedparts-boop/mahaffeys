import type { PoolClient } from 'pg';
import { query } from './db';

let ready: Promise<unknown> | undefined;
export function ensureIntakeOwnership() {
  if (!ready) ready = query(`CREATE TABLE IF NOT EXISTS intake_ownership (
    ticket_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    operator_name TEXT NOT NULL,
    client_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
  )`).catch(error => { ready = undefined; throw error; });
  return ready;
}
export function lockIntakeOwnership(client: PoolClient, id: string) {
  return client.query("SELECT pg_advisory_xact_lock(hashtext('intake-ownership:' || $1))", [id]);
}
