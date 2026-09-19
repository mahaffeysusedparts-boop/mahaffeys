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

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      id_type TEXT NOT NULL CHECK (id_type IN ('Driver License', 'State ID', 'Passport', 'Military ID')),
      id_number TEXT NOT NULL,
      id_state TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      vehicle_license_plate TEXT,
      vehicle_state TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      total_payouts NUMERIC(14, 2) NOT NULL DEFAULT 0,
      total_weight_lbs BIGINT NOT NULL DEFAULT 0,
      id_photo_url TEXT,
      captured_plates JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_commercial BOOLEAN NOT NULL DEFAULT FALSE,
      company_name TEXT,
      business_address TEXT
    );
    CREATE INDEX IF NOT EXISTS customers_full_name_idx ON customers (LOWER(full_name));
    CREATE INDEX IF NOT EXISTS customers_company_name_idx ON customers (LOWER(company_name)) WHERE company_name IS NOT NULL;
    CREATE INDEX IF NOT EXISTS customers_id_number_idx ON customers (LOWER(id_number));
    CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);
    CREATE INDEX IF NOT EXISTS customers_plate_idx ON customers (LOWER(vehicle_license_plate)) WHERE vehicle_license_plate IS NOT NULL;
    CREATE INDEX IF NOT EXISTS customers_created_at_idx ON customers (created_at DESC);

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

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      detail JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS audit_log_action_idx ON audit_log(action);
    CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log(entity);

    CREATE TABLE IF NOT EXISTS media_uploads (
      id UUID PRIMARY KEY,
      file_name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      content BYTEA NOT NULL,
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS media_uploads_created_at_idx ON media_uploads(created_at);

    CREATE TABLE IF NOT EXISTS vision_scans (
      id UUID PRIMARY KEY,
      purpose TEXT NOT NULL CHECK (purpose IN ('vehicle', 'plate', 'scrap')),
      status TEXT NOT NULL CHECK (status IN ('processing', 'review_required', 'confirmed', 'failed')),
      original_file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL UNIQUE,
      content_type TEXT NOT NULL,
      byte_size INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      confidence NUMERIC,
      worker_model_version TEXT,
      error_message TEXT,
      linked_record_type TEXT,
      linked_record_id TEXT,
      uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      processed_at TIMESTAMPTZ,
      confirmed_at TIMESTAMPTZ,
      retention_delete_after TIMESTAMPTZ NOT NULL,
      deleted_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS vision_scans_recent_idx ON vision_scans(created_at DESC);
    CREATE INDEX IF NOT EXISTS vision_scans_status_idx ON vision_scans(status);

    CREATE TABLE IF NOT EXISTS vision_results (
      scan_id UUID PRIMARY KEY REFERENCES vision_scans(id) ON DELETE CASCADE,
      raw_ocr_text TEXT,
      normalized_vin TEXT,
      vin_valid BOOLEAN,
      vin_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      plate_text TEXT,
      plate_state TEXT,
      decode JSONB,
      materials JSONB NOT NULL DEFAULT '[]'::jsonb,
      contamination_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vision_candidates (
      id UUID PRIMARY KEY,
      scan_id UUID NOT NULL REFERENCES vision_scans(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      candidate_text TEXT NOT NULL,
      confidence NUMERIC NOT NULL,
      source TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS vision_candidates_scan_idx ON vision_candidates(scan_id);

    CREATE TABLE IF NOT EXISTS vin_decode_cache (
      vin TEXT PRIMARY KEY,
      decode JSONB NOT NULL,
      fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vision_confirmations (
      id UUID PRIMARY KEY,
      scan_id UUID NOT NULL REFERENCES vision_scans(id) ON DELETE RESTRICT,
      confirmed_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      selections JSONB NOT NULL,
      linked_record_type TEXT,
      linked_record_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await getPool().query(`
    INSERT INTO customers (
      id, full_name, phone, id_type, id_number, id_state, address,
      vehicle_license_plate, vehicle_state, notes, created_at,
      total_payouts, total_weight_lbs, id_photo_url, captured_plates,
      is_commercial, company_name, business_address
    )
    SELECT
      customer->>'id',
      COALESCE(NULLIF(customer->>'fullName', ''), 'Unknown Customer'),
      COALESCE(customer->>'phone', ''),
      CASE WHEN customer->>'idType' IN ('Driver License', 'State ID', 'Passport', 'Military ID')
        THEN customer->>'idType' ELSE 'Driver License' END,
      COALESCE(customer->>'idNumber', ''),
      COALESCE(NULLIF(customer->>'idState', ''), 'GA'),
      COALESCE(customer->>'address', ''),
      NULLIF(customer->>'vehicleLicensePlate', ''),
      NULLIF(customer->>'vehicleState', ''),
      NULLIF(customer->>'notes', ''),
      CASE WHEN COALESCE(customer->>'createdAt', '') ~ '^\\d{4}-\\d{2}-\\d{2}T'
        THEN (customer->>'createdAt')::timestamptz ELSE NOW() END,
      CASE WHEN COALESCE(customer->>'totalPayouts', '') ~ '^\\d+(\\.\\d+)?$'
        THEN (customer->>'totalPayouts')::numeric ELSE 0 END,
      CASE WHEN COALESCE(customer->>'totalWeightLbs', '') ~ '^\\d+$'
        THEN (customer->>'totalWeightLbs')::bigint ELSE 0 END,
      NULLIF(customer->>'idPhotoUrl', ''),
      CASE WHEN jsonb_typeof(customer->'capturedPlates') = 'array'
        THEN customer->'capturedPlates' ELSE '[]'::jsonb END,
      CASE WHEN LOWER(COALESCE(customer->>'isCommercial', 'false')) = 'true' THEN TRUE ELSE FALSE END,
      NULLIF(customer->>'companyName', ''),
      NULLIF(customer->>'businessAddress', '')
    FROM app_state
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(value) = 'array' THEN value ELSE '[]'::jsonb END
    ) AS customer
    WHERE key = 'mahaffeys_customers' AND customer ? 'id'
    ON CONFLICT (id) DO NOTHING
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
