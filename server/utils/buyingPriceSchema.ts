export const buyingPriceSchema = `
CREATE TABLE IF NOT EXISTS buying_price_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS scrap_buying_tickets (
 ticket_id TEXT PRIMARY KEY, revision INTEGER NOT NULL CHECK (revision > 0),
 stage TEXT NOT NULL CHECK (stage IN ('DRAFT','FINALIZED','PAID','VOIDED')),
 document JSONB NOT NULL, created_by TEXT NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scrap_buying_captures (
 id UUID PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES scrap_buying_tickets(ticket_id),
 document JSONB NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scrap_buying_cycles (
 id UUID PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES scrap_buying_tickets(ticket_id), number INTEGER NOT NULL,
 weighing_type TEXT NOT NULL CHECK(weighing_type IN ('PLATFORM','VEHICLE_IN_OUT')),
 status TEXT NOT NULL CHECK(status IN ('AWAITING_OUT','REVIEW','REVIEWED','CANCELLED')),
 document JSONB NOT NULL, UNIQUE(ticket_id,number)
);
CREATE TABLE IF NOT EXISTS scrap_buying_passes (
 id UUID PRIMARY KEY, cycle_id UUID NOT NULL REFERENCES scrap_buying_cycles(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('LOADED','TARE')), document JSONB NOT NULL, UNIQUE(cycle_id,purpose)
);
CREATE TABLE IF NOT EXISTS scrap_buying_capture_context (
 capture_id UUID PRIMARY KEY REFERENCES scrap_buying_captures(id), cycle_id UUID NOT NULL REFERENCES scrap_buying_cycles(id),
 pass_id UUID NOT NULL REFERENCES scrap_buying_passes(id), component_label TEXT NOT NULL,
 component_order INTEGER NOT NULL DEFAULT 1, UNIQUE(pass_id,component_order)
);
CREATE TABLE IF NOT EXISTS scrap_buying_lines (
 id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES scrap_buying_tickets(ticket_id),
 document JSONB NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE scrap_buying_lines ADD COLUMN IF NOT EXISTS source_cycle_id UUID REFERENCES scrap_buying_cycles(id);
CREATE UNIQUE INDEX IF NOT EXISTS scrap_buying_lines_source_cycle ON scrap_buying_lines(source_cycle_id);
CREATE TABLE IF NOT EXISTS scrap_buying_line_sources (
 capture_id UUID PRIMARY KEY REFERENCES scrap_buying_captures(id), line_id TEXT NOT NULL REFERENCES scrap_buying_lines(id)
);
CREATE TABLE IF NOT EXISTS scrap_buying_events (
 id UUID PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES scrap_buying_tickets(ticket_id), revision INTEGER NOT NULL,
 actor_id TEXT NOT NULL, idempotency_key UUID NOT NULL, request_hash TEXT NOT NULL,
 action TEXT NOT NULL, result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE(ticket_id, revision), UNIQUE(actor_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS scrap_buying_policies (
 version UUID PRIMARY KEY, document JSONB NOT NULL, created_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS scrap_buying_payments (
 ticket_id TEXT PRIMARY KEY REFERENCES scrap_buying_tickets(ticket_id), id UUID NOT NULL UNIQUE,
 amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0), method TEXT NOT NULL CHECK(method IN ('Cash','Check')),
 check_reference TEXT UNIQUE, drawer_entry_id TEXT UNIQUE, policy_version UUID NOT NULL REFERENCES scrap_buying_policies(version),
 document JSONB NOT NULL, paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS price_sheet_documents (
 id UUID PRIMARY KEY, file_name TEXT NOT NULL, content BYTEA NOT NULL, byte_size INTEGER NOT NULL,
 sha256 TEXT NOT NULL, uploaded_by TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS price_sheet_drafts (
 id UUID PRIMARY KEY REFERENCES price_sheet_documents(id), revision INTEGER NOT NULL DEFAULT 1,
 status TEXT NOT NULL CHECK(status IN ('PROCESSING','REVIEW','FAILED')),
 rows JSONB NOT NULL DEFAULT '[]', warnings JSONB NOT NULL DEFAULT '[]', extracted_text TEXT NOT NULL DEFAULT '',
 error TEXT, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS price_sheet_draft_revisions (
 document_id UUID NOT NULL REFERENCES price_sheet_documents(id), revision INTEGER NOT NULL,
 rows JSONB NOT NULL, warnings JSONB NOT NULL, status TEXT NOT NULL, actor_id TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(document_id,revision)
);
CREATE TABLE IF NOT EXISTS price_sheet_versions (
 id UUID PRIMARY KEY, document_id UUID REFERENCES price_sheet_documents(id), rows JSONB NOT NULL,
 published_by TEXT NOT NULL, published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), source_revision INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS price_sheet_active (
 singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton), version_id UUID NOT NULL REFERENCES price_sheet_versions(id),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE price_sheet_active ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE UNIQUE INDEX IF NOT EXISTS price_sheet_versions_source_revision ON price_sheet_versions(document_id,source_revision);
CREATE TABLE IF NOT EXISTS price_sheet_publication_events (
 id UUID PRIMARY KEY, version_id UUID NOT NULL REFERENCES price_sheet_versions(id), actor_id TEXT NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('PUBLISH','ROLLBACK')), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO buying_price_migrations(version) VALUES (1),(2) ON CONFLICT DO NOTHING;
`;

export const canonicalBackupTables = [
 'customers', 'scrap_buying_policies', 'scrap_buying_tickets', 'scrap_buying_captures', 'scrap_buying_cycles', 'scrap_buying_passes',
 'scrap_buying_capture_context', 'scrap_buying_lines', 'scrap_buying_line_sources', 'scrap_buying_events', 'scrap_buying_payments',
 'price_sheet_documents', 'price_sheet_drafts', 'price_sheet_draft_revisions', 'price_sheet_versions', 'price_sheet_active', 'price_sheet_publication_events',
] as const;
