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
  const userCount = await countUsers();
  const users = session ? await listUsersForSession(session) : [];
  let maskedUsers = [];

  if (!session?.authLevel) {
    try {
      maskedUsers = await listMaskedUsers();
    } catch {
      maskedUsers = [];
    }
  }

  sendJson(response, 200, { session, users, userCount, maskedUsers });
}
