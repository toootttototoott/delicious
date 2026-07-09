import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { checkRateLimit, getClientIp } from "../lib/rate-limit.js";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  sanitizePasswordResetRequestInput,
  sanitizePasswordResetSubmissionInput,
  validatePasswordResetToken,
} from "../lib/password-reset.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const clientIp = getClientIp(request);

    if (request.method === "GET") {
      const url = new URL(request.url, "https://bookings.local");
      const action = url.searchParams.get("action") ?? "validate";

      if (action !== "validate") {
        sendJson(response, 400, { error: "Unknown action." });
        return;
      }

      const validateLimit = checkRateLimit(`password-reset-validate:${clientIp}`, {
        windowMs: 10 * 60 * 1000,
        maxAttempts: 60,
        blockMs: 10 * 60 * 1000,
      });
      if (validateLimit.limited) {
        sendJson(
          response,
          429,
          { error: "Too many reset-link checks. Please wait and try again." },
          { "Retry-After": String(validateLimit.retryAfterSeconds) },
        );
        return;
      }

      const result = await validatePasswordResetToken(url.searchParams.get("token"));
      sendJson(response, result.valid ? 200 : 400, result);
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    const body = await readBody(request);
    const action = body.action ?? "request";

    if (action === "request") {
      const input = sanitizePasswordResetRequestInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const requestKeys = [
        `password-reset-request-ip:${clientIp}`,
        `password-reset-request-email:${input.email}`,
      ];
      for (const key of requestKeys) {
        const requestLimit = checkRateLimit(key, {
          windowMs: 60 * 60 * 1000,
          maxAttempts: 5,
          blockMs: 60 * 60 * 1000,
        });
        if (requestLimit.limited) {
          sendJson(
            response,
            429,
            { error: "Too many reset requests. Please wait and try again." },
            { "Retry-After": String(requestLimit.retryAfterSeconds) },
          );
          return;
        }
      }

      const result = await requestPasswordReset(input, request);
      if (result.error) {
        sendJson(response, 500, { error: result.error });
        return;
      }

      sendJson(response, 200, {
        message: "If that email address exists in the system, a reset link has been sent.",
      });
      return;
    }

    if (action === "reset") {
      const resetLimit = checkRateLimit(`password-reset-submit:${clientIp}`, {
        windowMs: 30 * 60 * 1000,
        maxAttempts: 10,
        blockMs: 30 * 60 * 1000,
      });
      if (resetLimit.limited) {
        sendJson(
          response,
          429,
          { error: "Too many password reset attempts. Please wait and try again." },
          { "Retry-After": String(resetLimit.retryAfterSeconds) },
        );
        return;
      }

      const input = sanitizePasswordResetSubmissionInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const result = await resetPasswordWithToken(input);
      if (result.error) {
        sendJson(response, 400, { error: result.error });
        return;
      }

      sendJson(response, 200, { message: "Password updated. You can sign in now." });
      return;
    }

    sendJson(response, 400, { error: "Unknown action." });
  } catch (error) {
    console.error("Password reset API failed", error);
    sendJson(response, 500, { error: error.message ?? "Password reset request failed." });
  }
}
