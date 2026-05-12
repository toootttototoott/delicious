import pg from "pg";
import { databaseUrl, rejectUnauthorized } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized },
});

let schemaReadyPromise;
const SCHEMA_VERSION = 2;

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
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id STRING PRIMARY KEY,
      openai_model STRING NOT NULL DEFAULT 'gpt-5.4-nano',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS establishment_widget_themes (
      establishment_id UUID NOT NULL,
      widget_key STRING NOT NULL,
      css_text STRING NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (establishment_id, widget_key)
    )
  `);

  await pool.query(`
    UPSERT INTO app_settings (id, openai_model, updated_at)
    VALUES ('primary', 'gpt-5.4-nano', now())
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
