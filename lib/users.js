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
  return result.rows[0].count;
}

export async function listMaskedUsers() {
  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, email_hash, auth_level
     FROM app_users
     ORDER BY created_at ASC`,
  );

  return result.rows.map((row) => {
    try {
      const user = presentUser(row);
      const [namePart = "", domainPart = ""] = user.email.split("@");
      const maskedNamePart =
        namePart.length <= 2 ? `${namePart.slice(0, 1)}*` : `${namePart.slice(0, 2)}***`;

      return {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: domainPart ? `${maskedNamePart}@${domainPart}` : maskedNamePart,
        authLevel: user.authLevel,
      };
    } catch {
      return {
        id: row.id,
        name: "Encrypted record",
        email: `hash:${String(row.email_hash).slice(0, 10)}`,
        authLevel: row.auth_level,
      };
    }
  });
}

export async function listUsersForSession(session) {
  if (session?.authLevel !== "admin") {
    return [];
  }

  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level
     FROM app_users
     ORDER BY created_at ASC`,
  );

  return result.rows.map(presentUser);
}

export async function findLoginUser(email) {
  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, password_hash, auth_level
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
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level
     FROM app_users
     WHERE id = $1`,
    [payload.userId],
  );

  return result.rows[0] ? presentUser(result.rows[0]) : null;
}

export function sanitizeUserInput(body) {
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");
  const authLevel = body.authLevel === "admin" ? "admin" : "user";

  if (!firstName || !lastName || !email || !password) {
    return { error: "All fields are required." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  return { firstName, lastName, email, password, authLevel };
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
       auth_level
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, first_name_encrypted, last_name_encrypted, email_encrypted, auth_level`,
    [
      encryptText(input.firstName),
      encryptText(input.lastName),
      encryptText(input.email),
      hashEmail(input.email),
      passwordHash,
      input.authLevel,
    ],
  );

  return presentUser(inserted.rows[0]);
}

export function presentUser(row) {
  return {
    id: row.id,
    firstName: decryptText(row.first_name_encrypted),
    lastName: decryptText(row.last_name_encrypted),
    email: decryptText(row.email_encrypted),
    authLevel: row.auth_level,
  };
}

export function buildBootstrapCookie(user) {
  return createSessionCookie(user);
}
