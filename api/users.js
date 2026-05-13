import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import {
  buildBootstrapCookie,
  bulkDeleteUsers,
  countUsers,
  createUser,
  deleteUser,
  getSessionUserFromCookieHeader,
  sanitizeUserInput,
  updateUser,
} from "../lib/users.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  await ensureSchema();
  const body = await readBody(request);
  const action = body.action ?? "create";
  const existingUsersCount = await countUsers();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  const bootstrapMode = existingUsersCount === 0;
  const isAdmin = session?.authLevel === "admin";
  const isManager = session?.authLevel === "manager";

  if (!bootstrapMode && !isAdmin && !isManager) {
    sendJson(response, 403, { error: "Admin or manager access required." });
    return;
  }

  if (action === "create") {
    const managerBody = isManager
      ? {
          ...body,
          authLevel: "staff",
          companyId: session?.companyId ?? "",
          establishmentId: session?.establishmentId ?? "",
        }
      : body;
    if (isManager && !session?.establishmentId) {
      sendJson(response, 403, { error: "Manager account must be assigned to an establishment first." });
      return;
    }

    const normalizedInput = await sanitizeUserInput(managerBody, { passwordRequired: true });
    if (normalizedInput.error) {
      sendJson(response, 400, { error: normalizedInput.error });
      return;
    }

    if (bootstrapMode && normalizedInput.authLevel !== "admin") {
      sendJson(response, 400, { error: "The first account must be an admin." });
      return;
    }

    try {
      const user = await createUser(normalizedInput);
      const headers = bootstrapMode ? { "Set-Cookie": buildBootstrapCookie(user) } : {};
      sendJson(
        response,
        201,
        {
          message: bootstrapMode
            ? "Admin created and signed in."
            : isManager
              ? "Staff member created."
              : "User created.",
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

    return;
  }

  if (action === "update") {
    if (isManager) {
      sendJson(response, 403, { error: "Managers can only create staff accounts." });
      return;
    }

    const input = await sanitizeUserInput(body, { passwordRequired: false });
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    try {
      const user = await updateUser(body.userId, input);
      sendJson(response, 200, { message: "User updated.", user });
    } catch (error) {
      if (error.code === "23505") {
        sendJson(response, 409, { error: "That email is already in use." });
        return;
      }

      throw error;
    }

    return;
  }

  if (action === "delete") {
    if (isManager) {
      sendJson(response, 403, { error: "Managers can only create staff accounts." });
      return;
    }

    const result = await deleteUser(body.userId, session?.id);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "User deleted." });
    return;
  }

  if (action === "bulkDelete") {
    if (isManager) {
      sendJson(response, 403, { error: "Managers can only create staff accounts." });
      return;
    }

    const result = await bulkDeleteUsers(body.userIds ?? [], session?.id);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Selected users deleted." });
    return;
  }

  sendJson(response, 400, { error: "Unknown action." });
}
