import { getAppSettings } from "../lib/app-settings.js";
import { listCompaniesTreeForSession } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";
import { listWidgetEditorPrompts } from "../lib/widget-editor-prompts.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);

  if (!["admin", "manager", "staff"].includes(session?.authLevel)) {
    sendJson(response, 403, { error: "Settings access required." });
    return;
  }

  const [users, companies] = await Promise.all([
    listUsersForSession(session),
    listCompaniesTreeForSession(session),
  ]);

  if (session.authLevel === "admin") {
    const [appSettings, widgetEditorPrompts] = await Promise.all([
      getAppSettings(),
      listWidgetEditorPrompts(),
    ]);
    sendJson(response, 200, { users, companies, appSettings, widgetEditorPrompts });
    return;
  }

  sendJson(response, 200, { users, companies, appSettings: null, widgetEditorPrompts: [] });
}
