import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import express from "express";
import pg from "pg";

dotenv.config();

const app = express();
const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const indexPath = path.join(__dirname, "index.html");
const appScriptPath = path.join(__dirname, "app.js");
const stylesPath = path.join(__dirname, "styles.css");
const port = Number(process.env.PORT ?? 3000);
const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_RUL;
const encryptKeySource = process.env.ENCRYPT_KEY ?? process.env.ENCYRPT_KEY;
const rejectUnauthorized = process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false";

if (!databaseUrl) {
  throw new Error("Set DATABASE_URL. DATABASE_RUL is supported as a fallback for the current typo.");
}

if (!encryptKeySource) {
  throw new Error("Set ENCRYPT_KEY. ENCYRPT_KEY is supported as a fallback for the current typo.");
}

const encryptionKey = crypto.createHash("sha256").update(encryptKeySource).digest();
const signingKey = crypto
  .createHash("sha256")
  .update(`session:${encryptKeySource}`)
  .digest();

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized },
});

app.use(express.json());
app.get("/app.js", (_request, response) => {
  response.type("application/javascript").sendFile(appScriptPath);
});

app.get("/styles.css", (_request, response) => {
  response.type("text/css").sendFile(stylesPath);
});

app.get("/api/health", async (_request, response) => {
  const result = await pool.query("SELECT now() AS now");
  response.json({ ok: true, now: result.rows[0].now });
});

app.get("/api/session", async (request, response) => {
  const session = await getSessionUser(request);
  const users = await listUsersForSession(session);
  response.json({ session, users });
});

app.post("/api/login", async (request, response) => {
  const email = normalizeEmail(request.body.email);
  const password = String(request.body.password ?? "");

  if (!email || !password) {
    response.status(400).json({ error: "Email and password are required." });
    return;
  }

  const result = await pool.query(
    `SELECT id, first_name_encrypted, last_name_encrypted, email_encrypted, password_hash, auth_level
     FROM app_users
     WHERE email_hash = $1`,
    [hashEmail(email)],
  );

  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    response.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const session = presentUser(user);
  response.setHeader("Set-Cookie", createSessionCookie(session));
  response.json({ session });
});

app.post("/api/logout", (_request, response) => {
  response.setHeader("Set-Cookie", clearSessionCookie());
  response.json({ ok: true });
});

app.post("/api/users", async (request, response) => {
  const existingUsersCount = await countUsers();
  const session = await getSessionUser(request);
  const bootstrapMode = existingUsersCount === 0;

  if (!bootstrapMode && session?.authLevel !== "admin") {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  const input = sanitizeUserInput(request.body);
  if (input.error) {
    response.status(400).json({ error: input.error });
    return;
  }

  if (bootstrapMode && input.authLevel !== "admin") {
    response.status(400).json({ error: "The first account must be an admin." });
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
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

    const createdUser = presentUser(inserted.rows[0]);
    if (bootstrapMode) {
      response.setHeader("Set-Cookie", createSessionCookie(createdUser));
    }

    response.status(201).json({
      message: bootstrapMode ? "Admin created and signed in." : "User created.",
      user: createdUser,
    });
  } catch (error) {
    if (error.code === "23505") {
      response.status(409).json({ error: "That email is already in use." });
      return;
    }

    throw error;
  }
});

app.get(/^(?!\/api\/).*/, async (_request, response) => {
  response.type("html").send(await fs.readFile(indexPath, "utf8"));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: "Internal server error." });
});

await ensureSchema();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

async function ensureSchema() {
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
}

async function countUsers() {
  const result = await pool.query("SELECT count(*)::INT AS count FROM app_users");
  return result.rows[0].count;
}

async function listUsersForSession(session) {
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

async function getSessionUser(request) {
  const token = readCookie(request.headers.cookie ?? "", "booking_session");
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

  if (!result.rows[0]) {
    return null;
  }

  return presentUser(result.rows[0]);
}

function sanitizeUserInput(body) {
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

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase();
}

function hashEmail(email) {
  return crypto.createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

function encryptText(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${encrypted.toString("base64url")}`;
}

function decryptText(value) {
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

function presentUser(row) {
  return {
    id: row.id,
    firstName: decryptText(row.first_name_encrypted),
    lastName: decryptText(row.last_name_encrypted),
    email: decryptText(row.email_encrypted),
    authLevel: row.auth_level,
  };
}

function createSessionCookie(user) {
  const token = signValue(
    JSON.stringify({
      userId: user.id,
      expiresAt: Date.now() + 1000 * 60 * 60 * 12,
    }),
  );
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `booking_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${secure}`;
}

function clearSessionCookie() {
  return "booking_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

function signValue(value) {
  const payload = Buffer.from(value).toString("base64url");
  const signature = crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySignedValue(token) {
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

function readCookie(cookieHeader, cookieName) {
  const pairs = cookieHeader.split(";").map((part) => part.trim());
  const match = pairs.find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
}
