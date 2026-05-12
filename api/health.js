import { ensureSchema, pool } from "../lib/db.js";

export default async function handler(_request, response) {
  await ensureSchema();
  const result = await pool.query("SELECT now() AS now");
  response.status(200).json({ ok: true, now: result.rows[0].now });
}
