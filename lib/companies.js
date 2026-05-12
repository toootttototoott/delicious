import { pool } from "./db.js";

export async function listCompaniesTree() {
  const [companiesResult, establishmentsResult, seatCountsResult] = await Promise.all([
    pool.query("SELECT id, name FROM companies ORDER BY name ASC"),
    pool.query("SELECT id, company_id, name FROM establishments ORDER BY name ASC"),
    pool.query(
      "SELECT id, establishment_id, seat_count FROM establishment_seat_counts ORDER BY seat_count ASC",
    ),
  ]);

  const seatCountsByEstablishment = new Map();
  for (const row of seatCountsResult.rows) {
    const existing = seatCountsByEstablishment.get(row.establishment_id) ?? [];
    existing.push({
      id: row.id,
      establishmentId: row.establishment_id,
      seatCount: Number(row.seat_count),
    });
    seatCountsByEstablishment.set(row.establishment_id, existing);
  }

  const establishmentsByCompany = new Map();
  for (const row of establishmentsResult.rows) {
    const existing = establishmentsByCompany.get(row.company_id) ?? [];
    existing.push({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      seatCounts: seatCountsByEstablishment.get(row.id) ?? [],
    });
    establishmentsByCompany.set(row.company_id, existing);
  }

  return companiesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    establishments: establishmentsByCompany.get(row.id) ?? [],
  }));
}

export function sanitizeCompanyInput(body) {
  const name = String(body.name ?? "").trim();
  if (!name) {
    return { error: "Company name is required." };
  }

  return { name };
}

export async function createCompany(input) {
  const result = await pool.query(
    `INSERT INTO companies (name)
     VALUES ($1)
     RETURNING id, name`,
    [input.name],
  );

  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    establishments: [],
  };
}

export async function updateCompany(companyId, input) {
  const normalizedCompanyId = normalizeId(companyId);
  if (!normalizedCompanyId) {
    throw new Error("Invalid company id.");
  }

  const result = await pool.query(
    `UPDATE companies
     SET name = $1
     WHERE id = $2
     RETURNING id, name`,
    [input.name, normalizedCompanyId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        name: result.rows[0].name,
      }
    : null;
}

export async function deleteCompany(companyId) {
  const ids = [normalizeId(companyId)].filter(Boolean);
  if (!ids.length) {
    return { error: "Invalid company id." };
  }

  await deleteCompaniesByIds(ids);
  return { ok: true };
}

export async function bulkDeleteCompanies(companyIds) {
  const ids = companyIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one company." };
  }

  await deleteCompaniesByIds(ids);
  return { ok: true };
}

export function sanitizeEstablishmentInput(body) {
  const companyId = normalizeId(body.companyId);
  const name = String(body.name ?? "").trim();

  if (!companyId) {
    return { error: "Company is required." };
  }

  if (!name) {
    return { error: "Establishment name is required." };
  }

  return { companyId, name };
}

export async function createEstablishment(input) {
  const result = await pool.query(
    `INSERT INTO establishments (company_id, name)
     VALUES ($1, $2)
     RETURNING id, company_id, name`,
    [input.companyId, input.name],
  );

  return {
    id: result.rows[0].id,
    companyId: result.rows[0].company_id,
    name: result.rows[0].name,
    seatCounts: [],
  };
}

export async function updateEstablishment(establishmentId, input) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    throw new Error("Invalid establishment id.");
  }

  const result = await pool.query(
    `UPDATE establishments
     SET name = $1
     WHERE id = $2
     RETURNING id, company_id, name`,
    [input.name, normalizedEstablishmentId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        companyId: result.rows[0].company_id,
        name: result.rows[0].name,
      }
    : null;
}

export async function deleteEstablishment(establishmentId) {
  return bulkDeleteEstablishments([establishmentId]);
}

export function sanitizeSeatCountInput(body) {
  const establishmentId = normalizeId(body.establishmentId);
  const seatCount = Number(body.seatCount);

  if (!establishmentId) {
    return { error: "Establishment is required." };
  }

  if (!Number.isInteger(seatCount) || seatCount <= 0) {
    return { error: "Seat count must be a positive whole number." };
  }

  return { establishmentId, seatCount };
}

export async function createSeatCount(input) {
  const result = await pool.query(
    `INSERT INTO establishment_seat_counts (establishment_id, seat_count)
     VALUES ($1, $2)
     RETURNING id, establishment_id, seat_count`,
    [input.establishmentId, input.seatCount],
  );

  return {
    id: result.rows[0].id,
    establishmentId: result.rows[0].establishment_id,
    seatCount: Number(result.rows[0].seat_count),
  };
}

export async function updateSeatCount(seatCountId, input) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  if (!normalizedSeatCountId) {
    throw new Error("Invalid seat count id.");
  }

  const result = await pool.query(
    `UPDATE establishment_seat_counts
     SET seat_count = $1
     WHERE id = $2
     RETURNING id, establishment_id, seat_count`,
    [input.seatCount, normalizedSeatCountId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        establishmentId: result.rows[0].establishment_id,
        seatCount: Number(result.rows[0].seat_count),
      }
    : null;
}

export async function deleteSeatCount(seatCountId) {
  return bulkDeleteSeatCounts([seatCountId]);
}

export async function bulkDeleteEstablishments(establishmentIds) {
  const ids = establishmentIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one establishment." };
  }

  await pool.query("DELETE FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])", [
    ids,
  ]);
  await pool.query("DELETE FROM establishments WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

export async function bulkDeleteSeatCounts(seatCountIds) {
  const ids = seatCountIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one seat count." };
  }

  await pool.query("DELETE FROM establishment_seat_counts WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

async function deleteCompaniesByIds(companyIds) {
  const establishmentIdsResult = await pool.query(
    "SELECT id FROM establishments WHERE company_id = ANY($1::UUID[])",
    [companyIds],
  );
  const establishmentIds = establishmentIdsResult.rows.map((row) => row.id);

  await pool.query("UPDATE app_users SET company_id = NULL WHERE company_id = ANY($1::UUID[])", [
    companyIds,
  ]);

  if (establishmentIds.length) {
    await pool.query(
      "DELETE FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])",
      [establishmentIds],
    );
  }

  await pool.query("DELETE FROM establishments WHERE company_id = ANY($1::UUID[])", [companyIds]);
  await pool.query("DELETE FROM companies WHERE id = ANY($1::UUID[])", [companyIds]);
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
