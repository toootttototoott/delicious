import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DOCS_DIR = path.resolve(__dirname, "..", "legal-docs");
const PUBLIC_DOCS_CSS_PATH = path.join(PUBLIC_DOCS_DIR, "legal-docs.css");

const PUBLIC_DOCS = new Map([
  ["privacy-policy", "privacy-policy"],
  ["privacy-collection-notice", "privacy-collection-notice"],
]);

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  const url = new URL(request.url, "https://bookings.local");
  const documentKey = String(url.searchParams.get("doc") ?? "").trim();
  const format = String(url.searchParams.get("format") ?? "html").trim().toLowerCase();
  const fileStem = PUBLIC_DOCS.get(documentKey);

  if (!fileStem || !["html", "pdf"].includes(format)) {
    response.status(404).json({ error: "Document not found." });
    return;
  }

  const extension = format === "pdf" ? ".pdf" : ".html";
  const filePath = path.join(PUBLIC_DOCS_DIR, `${fileStem}${extension}`);

  try {
    if (format === "html") {
      const [html, css] = await Promise.all([
        fs.readFile(filePath, "utf8"),
        fs.readFile(PUBLIC_DOCS_CSS_PATH, "utf8"),
      ]);

      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("Cache-Control", "public, max-age=300");
      response.status(200).send(inlineCss(html, css));
      return;
    }

    const buffer = await fs.readFile(filePath);
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "public, max-age=300");
    response.setHeader("Content-Disposition", `inline; filename="${fileStem}.pdf"`);
    response.status(200).send(buffer);
  } catch {
    response.status(404).json({ error: "Document not found." });
  }
}

function inlineCss(html, css) {
  return String(html).replace(
    /<link rel="stylesheet" href="\.\/legal-docs\.css" \/>/i,
    `<style>${css}</style>`,
  );
}
