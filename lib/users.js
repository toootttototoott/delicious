import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import {
  createSessionCookie,
  decryptText,
  encryptText,
  hashEmail,
  normalizeEmail,
  readCookie,
  verifySignedValue,
} from "./security.js";

export async function countUsers() {
  const result = await pool.query("SELECT count(*)::INT AS count FROM app_users");
  return Number(result.rows[0].count ?? 0);
}

export async function listUsersForSession(session) {
  if (session?.authLevel !== "admin") {
    return [];
  }

  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level, company_id
     FROM app_users
     ORDER BY created_at ASC`,
  );

  return result.rows.map(presentUser);
}

export async function findLoginUser(email) {
  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, password_hash, auth_level, company_id
     FROM app_users
     WHERE email_hash = $1`,
    [hashEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function verifyLogin(email, password) {
  const user = await findLoginUser(email);
  if (!user) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return null;
  }

  try {
    return presentUser(user);
  } catch (error) {
    error.code = "DECRYPT_FAILED";
    throw error;
  }
}

export async function getSessionUserFromCookieHeader(cookieHeader) {
  const token = readCookie(cookieHeader, "booking_session");
  if (!token) {
    return null;
  }

  const payload = verifySignedValue(token);
  if (!payload) {
    return null;
  }

  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level, company_id
     FROM app_users
     WHERE id = $1`,
    [payload.userId],
  );

  return result.rows[0] ? presentUser(result.rows[0]) : null;
}

export function sanitizeUserInput(body, options = {}) {
  const passwordRequired = options.passwordRequired ?? true;
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const authLevel = body.authLevel === "admin" ? "admin" : "user";
  const companyId = normalizeId(body.companyId);

  if (!firstName || !lastName || !email) {
    return { error: "First name, last name, and email are required." };
  }

  if (passwordRequired && !password) {
    return { error: "Password is required." };
  }

  if (password && password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  if (body.companyId && companyId === undefined) {
    return { error: "Invalid company selection." };
  }

  return {
    firstName,
    lastName,
    email,
    password,
    authLevel,
    companyId: companyId ?? null,
  };
}

export async function createUser(input) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  const inserted = await pool.query(
    `INSERT INTO app_users (
       first_name_encrypted,
       last_name_encrypted,
       email_encrypted,
       email_hash,
       password_hash,
       auth_level,
       company_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level, company_id`,
    [
      encryptText(input.firstName),
      encryptText(input.lastName),
      encryptText(input.email),
      hashEmail(input.email),
      passwordHash,
      input.authLevel,
      input.companyId,
    ],
  );

  return presentUser(inserted.rows[0]);
}

export async function updateUser(userId, input) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    throw new Error("Invalid user id.");
  }

  const values = [
    encryptText(input.firstName),
    encryptText(input.lastName),
    encryptText(input.email),
    hashEmail(input.email),
    input.authLevel,
    input.companyId,
    normalizedUserId,
  ];

  let query = `
    UPDATE app_users
    SET
      first_name_encrypted = $1,
      last_name_encrypted = $2,
      email_encrypted = $3,
      email_hash = $4,
      auth_level = $5,
      company_id = $6
  `;

  if (input.password) {
    values.splice(6, 0, await bcrypt.hash(input.password, 12));
    query += `,
      password_hash = $7
      WHERE id = $8
      RETURNING id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level, company_id
    `;
  } else {
    query += `
      WHERE id = $7
      RETURNING id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level, company_id
    `;
  }

  const result = await pool.query(query, values);
  return result.rows[0] ? presentUser(result.rows[0]) : null;
}

export async function deleteUser(userId, currentUserId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    throw new Error("Invalid user id.");
  }

  if (normalizedUserId === normalizeId(currentUserId)) {
    return { error: "You cannot delete your own account." };
  }

  await pool.query("DELETE FROM app_users WHERE id = $1", [normalizedUserId]);
  return { ok: true };
}

export async function bulkDeleteUsers(userIds, currentUserId) {
  const ids = userIds.map(normalizeId).filter(Boolean);
  const selfId = normalizeId(currentUserId);

  if (!ids.length) {
    return { error: "Select at least one user." };
  }

  if (selfId && ids.includes(selfId)) {
    return { error: "You cannot bulk delete your own account." };
  }

  await pool.query("DELETE FROM app_users WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

export function presentUser(row) {
  return {
    id: row.id,
    firstName: decryptText(row.first_name_encrypted),
    lastName: decryptText(row.last_name_encrypted),
    email: decryptText(row.email_encrypted),
    authLevel: row.auth_level,
    companyId: row.company_id ?? null,
  };
}

export function buildBootstrapCookie(user) {
  return createSessionCookie(user);
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
