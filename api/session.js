import { listCompaniesTree } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { countUsers, getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const userCount = await countUsers();
  const users = session ? await listUsersForSession(session) : [];
  const companies = session?.authLevel === "admin" ? await listCompaniesTree() : [];
  sendJson(response, 200, { session, users, userCount, companies });
}
