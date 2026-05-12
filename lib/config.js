import crypto from "node:crypto";

export const port = Number(process.env.PORT ?? 3000);
export const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_RUL;
export const encryptKeySource = process.env.ENCRYPT_KEY ?? process.env.ENCYRPT_KEY;
export const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

if (!databaseUrl) {
  throw new Error("Set DATABASE_URL. DATABASE_RUL is supported as a fallback for the current typo.");
}

if (!encryptKeySource) {
  throw new Error("Set ENCRYPT_KEY. ENCYRPT_KEY is supported as a fallback for the current typo.");
}

export const encryptionKey = crypto.createHash("sha256").update(encryptKeySource).digest();
export const signingKey = crypto
  .createHash("sha256")
  .update(`session:${encryptKeySource}`)
  .digest();
