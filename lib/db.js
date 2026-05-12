import pg from "pg";
import { databaseUrl, rejectUnauthorized } from "./config.js";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized },
});

let schemaReadyPromise;

export function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
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
        CREATE TABLE IF NOT EXISTS app_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          first_name_encrypted STRING NOT NULL,
          last_name_encrypted STRING NOT NULL,
          email_encrypted STRING NOT NULL,
          email_hash STRING NOT NULL UNIQUE,
          password_hash STRING NOT NULL,
          auth_level STRING NOT NULL CHECK (auth_level IN ('admin', 'user')),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      await pool.query(`
        ALTER TABLE app_users
        ADD COLUMN IF NOT EXISTS company_id UUID
      `);
    })();
  }

  return schemaReadyPromise;
}
