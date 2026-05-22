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

const STAFF_ROLES = new Set(["manager", "staff"]);
const VALID_AUTH_LEVELS = new Set(["admin", "user", "manager", "staff"]);
const SETTINGS_AUTH_LEVELS = new Set(["admin", "manager", "staff"]);

export async function countUsers() {
  const result = await pool.query("SELECT count(*)::INT AS count FROM app_users");
  return Number(result.rows[0].count ?? 0);
}

export async function listUsersForSession(session) {
  if (!SETTINGS_AUTH_LEVELS.has(session?.authLevel)) {
    return [];
  }

  if (session.authLevel === "manager") {
    if (!session.establishmentId) {
      return [];
    }

    const result = await pool.query(
      `SELECT
         u.id,
         u.first_name_encrypted,
         u.last_name_encrypted,
         u.email_encrypted,
         u.auth_level,
         u.company_id,
         u.establishment_id
       FROM app_users u
       WHERE u.establishment_id = $1
         AND u.auth_level = 'staff'
       ORDER BY u.created_at ASC`,
      [session.establishmentId],
    );

    return result.rows.map(presentUser);
  }

  if (session.authLevel !== "admin") {
    return [];
  }

  const result = await pool.query(
    `SELECT
       u.id,
       u.first_name_encrypted,
       u.last_name_encrypted,
       u.email_encrypted,
       u.auth_level,
       u.company_id,
       u.establishment_id
     FROM app_users u
     ORDER BY u.created_at ASC`,
  );

  return result.rows.map(presentUser);
}

export async function getUserById(userId) {
  const normalizedUserId = normalizeId(userId);
  if (!normalizedUserId) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       u.id,
       u.first_name_encrypted,
       u.last_name_encrypted,
       u.email_encrypted,
       u.auth_level,
       u.company_id,
       u.establishment_id
     FROM app_users u
     WHERE u.id = $1`,
    [normalizedUserId],
  );

  return result.rows[0] ? presentUser(result.rows[0]) : null;
}

export async function findLoginUser(email) {
  const result = await pool.query(
    `SELECT
       u.id,
       u.first_name_encrypted,
       u.last_name_encrypted,
       u.email_encrypted,
       u.password_hash,
       u.auth_level,
       u.company_id,
       u.establishment_id
     FROM app_users u
     WHERE u.email_hash = $1`,
    [hashEmail(email)],
  );

  return result.rows[0] ?? null;
}

export async function verifyLogin(email, password) {
  const user = await findLoginUser(email);
  if (!user) {
    return null;
  }

  let ok;

  try {
    ok = await bcrypt.compare(password, user.password_hash);
  } catch (error) {
    error.code = "HASH_CHECK_FAILED";
    throw error;
  }

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
    `SELECT
       u.id,
       u.first_name_encrypted,
       u.last_name_encrypted,
       u.email_encrypted,
       u.auth_level,
       u.company_id,
       u.establishment_id
     FROM app_users u
     WHERE u.id = $1`,
    [payload.userId],
  );

  return result.rows[0] ? presentUser(result.rows[0]) : null;
}

export async function sanitizeUserInput(body, options = {}) {
  const passwordRequired = options.passwordRequired ?? true;
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const authLevel = VALID_AUTH_LEVELS.has(String(body.authLevel ?? "").trim())
    ? String(body.authLevel).trim()
    : "user";
  const companyId = normalizeId(body.companyId);
  const establishmentId = normalizeId(body.establishmentId);

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

  if (body.establishmentId && establishmentId === undefined) {
    return { error: "Invalid establishment selection." };
  }

  let resolvedCompanyId = companyId ?? null;
  let resolvedEstablishmentId = establishmentId ?? null;

  if (STAFF_ROLES.has(authLevel)) {
    if (!resolvedEstablishmentId) {
      return { error: `${capitalize(authLevel)} must be assigned to one establishment.` };
    }

    const result = await pool.query(
      "SELECT company_id FROM establishments WHERE id = $1",
      [resolvedEstablishmentId],
    );

    if (!result.rows[0]) {
      return { error: "Selected establishment does not exist." };
    }

    resolvedCompanyId = result.rows[0].company_id;
  } else if (resolvedEstablishmentId) {
    const result = await pool.query(
      "SELECT company_id FROM establishments WHERE id = $1",
      [resolvedEstablishmentId],
    );

    if (!result.rows[0]) {
      return { error: "Selected establishment does not exist." };
    }

    resolvedCompanyId = result.rows[0].company_id;
  }

  return {
    firstName,
    lastName,
    email,
    password,
    authLevel,
    companyId: resolvedCompanyId,
    establishmentId: resolvedEstablishmentId,
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
       company_id,
       establishment_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING
       id,
       first_name_encrypted,
       last_name_encrypted,
       email_encrypted,
       auth_level,
       company_id,
       establishment_id`,
    [
      encryptText(input.firstName),
      encryptText(input.lastName),
      encryptText(input.email),
      hashEmail(input.email),
      passwordHash,
      input.authLevel,
      input.companyId,
      input.establishmentId,
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
    input.establishmentId,
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
      company_id = $6,
      establishment_id = $7
  `;

  if (input.password) {
    values.splice(7, 0, await bcrypt.hash(input.password, 12));
    query += `,
      password_hash = $8
      WHERE id = $9
      RETURNING
        id,
        first_name_encrypted,
        last_name_encrypted,
        email_encrypted,
        auth_level,
        company_id,
        establishment_id
    `;
  } else {
    query += `
      WHERE id = $8
      RETURNING
        id,
        first_name_encrypted,
        last_name_encrypted,
        email_encrypted,
        auth_level,
        company_id,
        establishment_id
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
    establishmentId: row.establishment_id ?? null,
  };
}

export function buildBootstrapCookie(user) {
  return createSessionCookie(user);
}

export async function canManageUser(session, userId) {
  const user = await getUserById(userId);
  return user ? canManagePresentedUser(session, user) : false;
}

export async function updateUserForSession(session, userId, input) {
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    return { error: "User not found.", notFound: true };
  }

  if (!canManagePresentedUser(session, existingUser)) {
    return { error: "You cannot edit that user.", forbidden: true };
  }

  const user = await updateUser(userId, input);
  return user ? { ok: true, user } : { error: "User not found.", notFound: true };
}

export async function deleteUserForSession(session, userId) {
  const existingUser = await getUserById(userId);
  if (!existingUser) {
    return { error: "User not found.", notFound: true };
  }

  if (!canManagePresentedUser(session, existingUser)) {
    return { error: "You cannot delete that user.", forbidden: true };
  }

  if (normalizeId(existingUser.id) === normalizeId(session?.id)) {
    return { error: "You cannot delete your own account." };
  }

  await pool.query("DELETE FROM app_users WHERE id = $1", [existingUser.id]);
  return { ok: true };
}

export async function bulkDeleteUsersForSession(session, userIds) {
  const ids = userIds.map(normalizeId).filter(Boolean);
  const selfId = normalizeId(session?.id);

  if (!ids.length) {
    return { error: "Select at least one user." };
  }

  if (selfId && ids.includes(selfId)) {
    return { error: "You cannot bulk delete your own account." };
  }

  const result = await pool.query(
    `SELECT
       u.id,
       u.first_name_encrypted,
       u.last_name_encrypted,
       u.email_encrypted,
       u.auth_level,
       u.company_id,
       u.establishment_id
     FROM app_users u
     WHERE u.id = ANY($1::UUID[])`,
    [ids],
  );

  if (result.rows.length !== ids.length) {
    return { error: "One or more selected users could not be found.", notFound: true };
  }

  const users = result.rows.map(presentUser);
  if (users.some((user) => !canManagePresentedUser(session, user))) {
    return { error: "You cannot delete one or more selected users.", forbidden: true };
  }

  await pool.query("DELETE FROM app_users WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

function canManagePresentedUser(session, user) {
  if (!session || !user) {
    return false;
  }

  if (session.authLevel === "admin") {
    return true;
  }

  if (session.authLevel === "manager") {
    return (
      user.authLevel === "staff" &&
      Boolean(session.establishmentId) &&
      session.establishmentId === user.establishmentId
    );
  }

  return false;
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function capitalize(value) {
  return value.slice(0, 1).toUpperCase() + value.slice(1);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
