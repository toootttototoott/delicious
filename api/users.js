import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import {
  buildBootstrapCookie,
  countUsers,
  createUser,
  getSessionUserFromCookieHeader,
  sanitizeUserInput,
} from "../lib/users.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  await ensureSchema();
  const existingUsersCount = await countUsers();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const bootstrapMode = existingUsersCount === 0;

  if (!bootstrapMode && session?.authLevel !== "admin") {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  const input = sanitizeUserInput(await readBody(request));
  if (input.error) {
    sendJson(response, 400, { error: input.error });
    return;
  }

  if (bootstrapMode && input.authLevel !== "admin") {
    sendJson(response, 400, { error: "The first account must be an admin." });
    return;
  }

  try {
    const user = await createUser(input);
    const headers = bootstrapMode ? { "Set-Cookie": buildBootstrapCookie(user) } : {};

    sendJson(
      response,
      201,
      {
        message: bootstrapMode ? "Admin created and signed in." : "User created.",
        user,
      },
      headers,
    );
  } catch (error) {
    if (error.code === "23505") {
      sendJson(response, 409, { error: "That email is already in use." });
      return;
    }

    throw error;
  }
}
