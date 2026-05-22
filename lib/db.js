import pg from "pg";
import { databaseUrl, rejectUnauthorized } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized },
});

let schemaReadyPromise;
const SCHEMA_VERSION = 11;

export async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = runMigrations();
  }

  return schemaReadyPromise;
}

async function runMigrations() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_schema_state (
      id STRING PRIMARY KEY,
      schema_version INT8 NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const schemaState = await pool.query(
    "SELECT schema_version FROM app_schema_state WHERE id = 'primary'",
  );

  if (Number(schemaState.rows[0]?.schema_version ?? 0) >= SCHEMA_VERSION) {
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name STRING NOT NULL,
      enquiry_email STRING NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      company_id UUID NOT NULL,
      name STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishment_seat_counts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      establishment_id UUID NOT NULL,
      seat_count INT8 NOT NULL,
      guest_visit_minutes INT8 NOT NULL DEFAULT 90,
      max_party_size INT8 NOT NULL DEFAULT 40,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishment_opening_hours (
      establishment_id UUID NOT NULL,
      weekday_index INT8 NOT NULL,
      is_open BOOL NOT NULL DEFAULT false,
      open_time STRING,
      close_time STRING,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (establishment_id, weekday_index)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name_encrypted STRING NOT NULL,
      last_name_encrypted STRING NOT NULL,
      email_encrypted STRING NOT NULL,
      email_hash STRING NOT NULL UNIQUE,
      password_hash STRING NOT NULL,
      auth_level STRING NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS company_id UUID
  `);

  await pool.query(`
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS establishment_id UUID
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seat_count_id UUID NOT NULL,
      establishment_id UUID NOT NULL,
      booking_date STRING NOT NULL,
      booking_time STRING NOT NULL,
      party_size INT8 NOT NULL DEFAULT 1,
      visit_duration_minutes INT8 NOT NULL DEFAULT 90,
      customer_first_name_encrypted STRING NOT NULL,
      customer_last_name_encrypted STRING NOT NULL,
      customer_email_encrypted STRING NOT NULL,
      customer_phone_encrypted STRING NOT NULL,
      notes_encrypted STRING NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS party_size INT8 NOT NULL DEFAULT 1
  `);

  await pool.query(`
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS visit_duration_minutes INT8 NOT NULL DEFAULT 90
  `);

  await pool.query(`
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishment_widget_themes (
      establishment_id UUID NOT NULL,
      widget_key STRING NOT NULL,
      css_text STRING NOT NULL DEFAULT '',
      content_json STRING NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (establishment_id, widget_key)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS widget_editor_prompts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      widget_key STRING NOT NULL,
      name STRING NOT NULL,
      prompt_text STRING NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seat_count_closed_dates (
      seat_count_id UUID NOT NULL,
      booking_date STRING NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (seat_count_id, booking_date)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token_hash STRING NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await ensureAppSettingsSchema();
  await ensureCompanyEnquirySchema();
  await ensureWidgetThemeSchema();
  await ensureSeatCountClosedDatesSchema();
  await ensurePasswordResetSchema();
  await ensureSeatCountConfigSchema();

  await pool.query(`
    UPSERT INTO app_settings (
      id,
      openai_model,
      openai_reasoning_effort,
      widget_editor_upload_limit_bytes,
      widget_editor_max_output_tokens,
      updated_at
    )
    VALUES ('primary', 'gpt-5.4-nano', NULL, 2500000, 25000, now())
  `);

  await pool.query(`
    DROP INDEX IF EXISTS bookings@bookings_seat_slot_key
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS bookings_seat_slot_lookup
    ON bookings (seat_count_id, booking_date, booking_time)
  `);

  await updateUserAuthConstraint();

  await pool.query(`
    UPSERT INTO app_schema_state (id, schema_version, updated_at)
    VALUES ('primary', $1, now())
  `, [SCHEMA_VERSION]);
}

async function ensureAppSettingsSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id STRING PRIMARY KEY,
      openai_model STRING NOT NULL DEFAULT 'gpt-5.4-nano',
      openai_reasoning_effort STRING,
      widget_editor_upload_limit_bytes INT8 NOT NULL DEFAULT 2500000,
      widget_editor_max_output_tokens INT8 NOT NULL DEFAULT 25000,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS openai_reasoning_effort STRING
  `);

  await pool.query(`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS widget_editor_upload_limit_bytes INT8 NOT NULL DEFAULT 2500000
  `);

  await pool.query(`
    ALTER TABLE app_settings
    ADD COLUMN IF NOT EXISTS widget_editor_max_output_tokens INT8 NOT NULL DEFAULT 25000
  `);
}

async function ensureCompanyEnquirySchema() {
  await pool.query(`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS enquiry_email STRING NOT NULL DEFAULT ''
  `);
}

async function ensureWidgetThemeSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishment_widget_themes (
      establishment_id UUID NOT NULL,
      widget_key STRING NOT NULL,
      css_text STRING NOT NULL DEFAULT '',
      content_json STRING NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (establishment_id, widget_key)
    )
  `);

  await pool.query(`
    ALTER TABLE establishment_widget_themes
    ADD COLUMN IF NOT EXISTS content_json STRING NOT NULL DEFAULT ''
  `);
}

async function ensureSeatCountClosedDatesSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS seat_count_closed_dates (
      seat_count_id UUID NOT NULL,
      booking_date STRING NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (seat_count_id, booking_date)
    )
  `);
}

async function ensurePasswordResetSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      token_hash STRING NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_lookup
    ON password_reset_tokens (token_hash, expires_at)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_lookup
    ON password_reset_tokens (user_id, created_at DESC)
  `);
}

async function ensureSeatCountConfigSchema() {
  await pool.query(`
    ALTER TABLE establishment_seat_counts
    ADD COLUMN IF NOT EXISTS guest_visit_minutes INT8 NOT NULL DEFAULT 90
  `);

  await pool.query(`
    ALTER TABLE establishment_seat_counts
    ADD COLUMN IF NOT EXISTS max_party_size INT8 NOT NULL DEFAULT 40
  `);

  await pool.query(`
    ALTER TABLE bookings
    ADD COLUMN IF NOT EXISTS visit_duration_minutes INT8 NOT NULL DEFAULT 90
  `);
}

async function updateUserAuthConstraint() {
  const constraints = await pool.query(`
    SELECT constraint_name, details
    FROM [SHOW CONSTRAINTS FROM app_users]
  `);

  for (const row of constraints.rows) {
    const details = String(row.details ?? "");
    if (details.includes("auth_level")) {
      await pool.query(`ALTER TABLE app_users DROP CONSTRAINT IF EXISTS "${row.constraint_name}"`);
    }
  }

  await pool.query(`
    ALTER TABLE app_users
    ADD CONSTRAINT IF NOT EXISTS app_users_auth_level_check
    CHECK (auth_level IN ('admin', 'user', 'manager', 'staff'))
  `);
}
