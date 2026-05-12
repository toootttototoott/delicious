export async function readBody(request) {
  if (request.body && typeof request.body === "object") {
    return request.body;
  }

  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(response, statusCode, payload, headers = {}) {
  Object.entries(headers).forEach(([name, value]) => {
    response.setHeader(name, value);
  });
  response.status(statusCode).json(payload);
}
