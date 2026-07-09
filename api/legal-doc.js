import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureSchema } from "../lib/db.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INTERNAL_DOCS_DIR = path.resolve(__dirname, "_internal-compliance-docs");

const INTERNAL_DOCS = new Map([
  ["data-breach-response-plan", "data-breach-response-plan"],
  ["privacy-access-and-correction-procedure", "privacy-access-and-correction-procedure"],
  ["data-retention-and-deletion-policy", "data-retention-and-deletion-policy"],
]);

export default async function handler(request, response) {
  await ensureSchema();

  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  if (session?.authLevel !== "admin") {
    response.status(403).json({ error: "Admin access required." });
    return;
  }

  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const url = new URL(request.url, "https://bookings.local");
  const documentKey = String(url.searchParams.get("doc") ?? "").trim();
  const format = String(url.searchParams.get("format") ?? "html").trim().toLowerCase();
  const fileStem = INTERNAL_DOCS.get(documentKey);

  if (!fileStem || !["html", "pdf"].includes(format)) {
    response.status(404).json({ error: "Document not found." });
    return;
  }

  const extension = format === "pdf" ? ".pdf" : ".html";
  const filePath = path.join(INTERNAL_DOCS_DIR, `${fileStem}${extension}`);

  try {
    const buffer = await fs.readFile(filePath);
    response.setHeader("Content-Type", format === "pdf" ? "application/pdf" : "text/html; charset=utf-8");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader(
      "Content-Disposition",
      `${format === "pdf" ? "attachment" : "inline"}; filename="${fileStem}${extension}"`,
    );
    response.status(200).send(buffer);
  } catch {
    response.status(404).json({ error: "Document not found." });
  }
}
