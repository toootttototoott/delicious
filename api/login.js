import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { checkRateLimit, clearRateLimit, getClientIp } from "../lib/rate-limit.js";
import { createSessionCookie, normalizeEmail } from "../lib/security.js";
import { verifyLogin } from "../lib/users.js";

export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await ensureSchema();
    const body = await readBody(request);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");
    const clientIp = getClientIp(request);

    if (!email || !password) {
      sendJson(response, 400, { error: "Email and password are required." });
      return;
    }

    const rateLimitKeys = [
      `login-ip:${clientIp}`,
      `login-email:${email}`,
    ];

    for (const key of rateLimitKeys) {
      const result = checkRateLimit(key, {
        windowMs: 15 * 60 * 1000,
        maxAttempts: 10,
        blockMs: 30 * 60 * 1000,
      });

      if (result.limited) {
        sendJson(
          response,
          429,
          { error: "Too many sign-in attempts. Please wait and try again." },
          { "Retry-After": String(result.retryAfterSeconds) },
        );
        return;
      }
    }

    const session = await verifyLogin(email, password);

    if (!session) {
      sendJson(response, 401, { error: "Invalid email or password." });
      return;
    }

    for (const key of rateLimitKeys) {
      clearRateLimit(key);
    }

    sendJson(
      response,
      200,
      { session },
      { "Set-Cookie": createSessionCookie(session) },
    );
  } catch (error) {
    console.error("Login failed", error);

    if (error.code === "DECRYPT_FAILED") {
      sendJson(response, 500, {
        error: "Stored user data could not be decrypted. Check ENCRYPT_KEY and any legacy ENCRYPT_KEY_FALLBACKS for this environment.",
      });
      return;
    }

    if (error.code === "HASH_CHECK_FAILED") {
      sendJson(response, 500, {
        error: "Stored password hash is invalid for this user. Edit the user in settings and set a new password.",
      });
      return;
    }

    sendJson(response, 500, {
      error: `Login failed on the server: ${error.message ?? "Unknown error."}`,
    });
  }
}
