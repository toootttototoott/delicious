import crypto from "node:crypto";
import { encryptionKey, signingKey } from "./config.js";

const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS ?? 60 * 60 * 24 * 30);

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function hashEmail(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

export function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptText(value) {
  const [version, iv, tag, encrypted] = String(value).split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Invalid encrypted payload.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function signValue(value) {
  const payload = Buffer.from(value).toString("base64url");
  const signature = crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySignedValue(token) {
  const [payload, signature] = String(token).split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (!parsed.expiresAt || parsed.expiresAt < Date.now()) {
    return null;
  }

  return parsed;
}

export function createSessionCookie(user) {
  const token = signValue(
    JSON.stringify({
      userId: user.id,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  );
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `booking_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  return "booking_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

export function readCookie(cookieHeader, cookieName) {
  const pairs = String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim());
  const match = pairs.find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
}
