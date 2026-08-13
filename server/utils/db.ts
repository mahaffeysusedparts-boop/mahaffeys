import { Pool, type PoolClient, type QueryResultRow } from "pg";

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;

function getPool() {
  if (pool) return pool;

  const connectionString = process.env.NITRO_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("NITRO_DATABASE_URL is required. Point it to the local PostgreSQL Mahaffeys database.");
  }

  pool = new Pool({ connectionString, max: 10 });
  return pool;
}

async function initializeSchema() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      username TEXT NOT NULL,
      email TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'yard_manager', 'scale_operator', 'yard_employee')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
      created_at TIMESTAMPTZ NOT NULL,
      approved_at TIMESTAMPTZ,
      approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_uidx ON users (LOWER(username));
    CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uidx ON users (LOWER(email)) WHERE email IS NOT NULL;

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS state_upload_chunks (
      upload_id UUID NOT NULL,
      state_key TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      total_chunks INTEGER NOT NULL,
      chunk_data TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (upload_id, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS state_upload_chunks_created_at_idx ON state_upload_chunks(created_at);
  `);
}

export async function getDatabase() {
  if (!schemaReady) schemaReady = initializeSchema();
  await schemaReady;
  return getPool();
}

export async function query<Row extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  const database = await getDatabase();
  return database.query<Row>(text, values);
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const database = await getDatabase();
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
