import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { appOrigin } from "./config.js";
import { pool } from "./db.js";
import { sendPasswordResetEmail } from "./email.js";
import { decryptText, hashEmail, normalizeEmail } from "./security.js";

const PASSWORD_RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

export function sanitizePasswordResetRequestInput(body) {
  const email = normalizeEmail(body.email);

  if (!email) {
    return { error: "Enter a valid email address." };
  }

  return { email };
}

export function sanitizePasswordResetSubmissionInput(body) {
  const token = normalizeResetToken(body.token);
  const password = String(body.password ?? "");

  if (!token) {
    return { error: "Reset token is invalid." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  return { token, password };
}

export async function requestPasswordReset(input, request) {
  const user = await findPasswordResetUser(input.email);
  if (!user) {
    return { ok: true, sent: false };
  }

  const resetToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(resetToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  const resetLink = buildResetLink(resolveAppOrigin(request), resetToken);

  await pool.query(
    `DELETE FROM password_reset_tokens
     WHERE user_id = $1
        OR expires_at <= now()
        OR used_at IS NOT NULL`,
    [user.id],
  );

  await pool.query(
    `INSERT INTO password_reset_tokens (
       user_id,
       token_hash,
       expires_at
     )
     VALUES ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt.toISOString()],
  );

  const result = await sendPasswordResetEmail({
    recipientEmail: user.email,
    firstName: user.firstName,
    resetLink,
    expiresInLabel: "1 hour",
  });

  if (!result.sent) {
    return {
      ok: false,
      error: result.reason ?? "Password reset email could not be sent.",
    };
  }

  return { ok: true, sent: true };
}

export async function validatePasswordResetToken(token) {
  const normalizedToken = normalizeResetToken(token);
  if (!normalizedToken) {
    return { valid: false, error: "Reset token is invalid." };
  }

  const row = await findActivePasswordResetToken(normalizedToken);
  if (!row) {
    return { valid: false, error: "This password reset link is invalid or has expired." };
  }

  return { valid: true };
}

export async function resetPasswordWithToken(input) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tokenResult = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > now()
       LIMIT 1`,
      [hashResetToken(input.token)],
    );

    const tokenRow = tokenResult.rows[0];
    if (!tokenRow) {
      await client.query("ROLLBACK");
      return { error: "This password reset link is invalid or has expired." };
    }

    const passwordHash = await bcrypt.hash(input.password, 12);

    await client.query(
      `UPDATE app_users
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, tokenRow.user_id],
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = now()
       WHERE id = $1`,
      [tokenRow.id],
    );

    await client.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = $1
         AND id <> $2`,
      [tokenRow.user_id, tokenRow.id],
    );

    await client.query("COMMIT");
    return { ok: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function findPasswordResetUser(email) {
  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted
     FROM app_users
     WHERE email_hash = $1`,
    [hashEmail(email)],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    firstName: decryptText(row.first_name_encrypted),
    lastName: decryptText(row.last_name_encrypted),
    email: decryptText(row.email_encrypted),
  };
}

async function findActivePasswordResetToken(token) {
  const result = await pool.query(
    `SELECT id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [hashResetToken(token)],
  );

  return result.rows[0] ?? null;
}

function hashResetToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function normalizeResetToken(value) {
  const trimmed = String(value ?? "").trim();
  return /^[A-Za-z0-9_-]{20,200}$/.test(trimmed) ? trimmed : "";
}

function resolveAppOrigin(request) {
  if (appOrigin) {
    try {
      return new URL(appOrigin).origin;
    } catch {
      throw new Error("APP_ORIGIN must be a valid absolute URL.");
    }
  }

  const forwardedProto = String(request?.headers?.["x-forwarded-proto"] ?? "").trim();
  const host = String(request?.headers?.["x-forwarded-host"] ?? request?.headers?.host ?? "").trim();
  if (host) {
    return `${forwardedProto || "https"}://${host}`;
  }

  return "http://localhost:3000";
}

function buildResetLink(origin, token) {
  return `${origin.replace(/\/$/, "")}/login?resetToken=${encodeURIComponent(token)}`;
}
