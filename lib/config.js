import crypto from "node:crypto";

export const port = Number(process.env.PORT ?? 3000);
export const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_RUL;
export const encryptKeySource = process.env.ENCRYPT_KEY ?? process.env.ENCYRPT_KEY;
export const encryptKeyFallbackSources = String(process.env.ENCRYPT_KEY_FALLBACKS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
export const openAiApiKey = process.env.OPENAI_API_KEY ?? "";
export const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";
export const appOrigin = String(process.env.APP_ORIGIN ?? "").trim();
export const smtpHost = String(process.env.SMTP_HOST ?? "").trim();
export const smtpPass = String(process.env.SMTP_PASS ?? "");
export const smtpUser = String(process.env.SMTP_USER ?? "").trim();
export const smtpPort = normalizeSmtpPort(process.env.SMTP_PORT);
export const smtpSecure = normalizeSmtpSecure(process.env.SMTP_SECURE, smtpPort);

if (!databaseUrl) {
  throw new Error("Set DATABASE_URL. DATABASE_RUL is supported as a fallback for the current typo.");
}

if (!encryptKeySource) {
  throw new Error("Set ENCRYPT_KEY. ENCYRPT_KEY is supported as a fallback for the current typo.");
}

export const encryptionKey = crypto.createHash("sha256").update(encryptKeySource).digest();
export const encryptionKeys = [
  encryptionKey,
  ...encryptKeyFallbackSources.map((value) => crypto.createHash("sha256").update(value).digest()),
];
export const signingKey = crypto
  .createHash("sha256")
  .update(`session:${encryptKeySource}`)
  .digest();

function normalizeSmtpPort(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : 0;
}

function normalizeSmtpSecure(value, port) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return port === 465;
}
