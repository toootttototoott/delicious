import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { createSessionCookie, normalizeEmail } from "../lib/security.js";
import { verifyLogin } from "../lib/users.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  await ensureSchema();
  const body = await readBody(request);
  const email = normalizeEmail(body.email);
  const password = String(body.password ?? "");

  if (!email || !password) {
    sendJson(response, 400, { error: "Email and password are required." });
    return;
  }

  let session;

  try {
    session = await verifyLogin(email, password);
  } catch (error) {
    if (error.code === "DECRYPT_FAILED") {
      sendJson(response, 500, {
        error: "Stored user data could not be decrypted. Check ENCRYPT_KEY for this Vercel environment.",
      });
      return;
    }

    throw error;
  }

  if (!session) {
    sendJson(response, 401, { error: "Invalid email or password." });
    return;
  }

  sendJson(
    response,
    200,
    { session },
    { "Set-Cookie": createSessionCookie(session) },
  );
}
