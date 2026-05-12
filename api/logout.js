import { sendJson } from "../lib/http.js";
import { clearSessionCookie } from "../lib/security.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  sendJson(
    response,
    200,
    { ok: true },
    { "Set-Cookie": clearSessionCookie() },
  );
}
