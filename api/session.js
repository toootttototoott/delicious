import { listCompaniesTree } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { createSessionCookie } from "../lib/security.js";
import { countUsers, getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const userCount = await countUsers();
  const users = session ? await listUsersForSession(session) : [];
  const companies = session?.authLevel === "admin" ? await listCompaniesTree() : [];
  const headers = session ? { "Set-Cookie": createSessionCookie(session) } : {};
  sendJson(response, 200, { session, users, userCount, companies }, headers);
}
