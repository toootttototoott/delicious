import { sanitizeAppSettingsInput, updateAppSettings } from "../lib/app-settings.js";
import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
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
}
