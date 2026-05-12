import { getAppSettings } from "../lib/app-settings.js";
import { listCompaniesTree } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";
import { listWidgetEditorPrompts } from "../lib/widget-editor-prompts.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);

  if (session?.authLevel !== "admin") {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  const [users, companies, appSettings, widgetEditorPrompts] = await Promise.all([
    listUsersForSession(session),
    listCompaniesTree(),
    getAppSettings(),
    listWidgetEditorPrompts(),
  ]);

  sendJson(response, 200, { users, companies, appSettings, widgetEditorPrompts });
}
