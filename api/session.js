import { ensureSchema } from "../lib/db.js";
import { sendJson } from "../lib/http.js";
import {
  countUsers,
  getSessionUserFromCookieHeader,
  listMaskedUsers,
  listUsersForSession,
} from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const users = await listUsersForSession(session);
  const userCount = await countUsers();
  const maskedUsers = session?.authLevel === "admin" ? [] : await listMaskedUsers();
  sendJson(response, 200, { session, users, userCount, maskedUsers });
}
