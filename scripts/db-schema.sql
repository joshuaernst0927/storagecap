-- StorageCap database schema. Created 2026-09-22.
-- One record per PROPERTY, carried from lead through underwriting to close.

CREATE TABLE IF NOT EXISTS properties (
  id                  TEXT PRIMARY KEY,
  facility_name       TEXT,
  business_name       TEXT,
  owner_name          TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT,
  source              TEXT NOT NULL,
  source_url          TEXT,
  is_off_market       BOOLEAN NOT NULL DEFAULT FALSE,
  distress_signals    JSONB,
  signals             JSONB,
  college_town        JSONB,
  contact_info        JSONB,
  asking_price        NUMERIC,
  score               INTEGER,
  stage               TEXT NOT NULL DEFAULT 'lead',
  next_action         TEXT,
  next_action_due     TIMESTAMPTZ,
  dedupe_key          TEXT,
  first_seen          TIMESTAMPTZ,
  last_updated        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prop_stage  ON properties (stage);
CREATE INDEX IF NOT EXISTS idx_prop_source ON properties (source);
CREATE INDEX IF NOT EXISTS idx_prop_off    ON properties (is_off_market);
CREATE INDEX IF NOT EXISTS idx_prop_state  ON properties (state);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prop_dedupe ON properties (dedupe_key) WHERE dedupe_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS property_notes (
  id          BIGSERIAL PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'note',
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_prop ON property_notes (property_id, created_at DESC);

CREATE TABLE IF NOT EXISTS property_documents (
  id           BIGSERIAL PRIMARY KEY,
  property_id  TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  doc_type     TEXT,
  file_name    TEXT,
  extraction   JSONB,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_docs_prop ON property_documents (property_id, uploaded_at DESC);