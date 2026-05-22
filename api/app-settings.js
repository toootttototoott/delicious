import { sanitizeAppSettingsInput, updateAppSettings } from "../lib/app-settings.js";
import { ensureSchema } from "../lib/db.js";
import {
  sanitizeBookingConfirmationTestInput,
  sendBookingConfirmationTestEmail,
} from "../lib/email.js";
import { readBody, sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await ensureSchema();
    const session = await getSessionUserFromCookieHeader(request.headers.cookie);
    if (session?.authLevel !== "admin") {
      sendJson(response, 403, { error: "Admin access required." });
      return;
    }

    const body = await readBody(request);
    if (body.action === "sendTestBookingConfirmationEmail") {
      const input = sanitizeBookingConfirmationTestInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const result = await sendBookingConfirmationTestEmail(input);
      if (!result.sent) {
        sendJson(response, 400, { error: result.reason ?? "Test email could not be sent." });
        return;
      }

      sendJson(response, 200, { message: "Test booking confirmation email sent." });
      return;
    }

    if (body.action !== "updateOpenAiSettings" && body.action !== "updateOpenAiModel") {
      sendJson(response, 400, { error: "Unknown action." });
      return;
    }

    const input = sanitizeAppSettingsInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const appSettings = await updateAppSettings(input);
    sendJson(response, 200, { message: "OpenAI settings updated.", appSettings });
  } catch (error) {
    console.error("App settings API failed", error);
    sendJson(response, 500, { error: error.message ?? "App settings request failed." });
  }
}
