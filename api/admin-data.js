import { getAppSettings } from "../lib/app-settings.js";
import { listCompaniesTree } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);

  if (session?.authLevel !== "admin") {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  const [users, companies, appSettings] = await Promise.all([
    listUsersForSession(session),
    listCompaniesTree(),
    getAppSettings(),
  ]);

  sendJson(response, 200, { users, companies, appSettings });
}
