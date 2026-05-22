import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { createSessionCookie } from "../lib/security.js";
import { countUsers, getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const userCount = session ? 1 : await countUsers();
  const headers = session ? { "Set-Cookie": createSessionCookie(session) } : {};
  sendJson(response, 200, { session, userCount }, headers);
}
