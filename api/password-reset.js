import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
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

    if (request.method === "GET") {
      const url = new URL(request.url, "https://bookings.local");
      const action = url.searchParams.get("action") ?? "validate";

      if (action !== "validate") {
        sendJson(response, 400, { error: "Unknown action." });
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
