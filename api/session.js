import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader, listUsersForSession } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const users = await listUsersForSession(session);
  sendJson(response, 200, { session, users });
}
