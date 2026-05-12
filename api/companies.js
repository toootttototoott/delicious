import {
  bulkDeleteEstablishments,
  bulkDeleteCompanies,
  bulkDeleteSeatCounts,
  createCompany,
  createEstablishment,
  createSeatCount,
  deleteCompany,
  deleteEstablishment,
  deleteSeatCount,
  sanitizeCompanyInput,
  sanitizeEstablishmentInput,
  sanitizeOpeningHoursInput,
  sanitizeSeatCountInput,
  updateCompany,
  updateEstablishment,
  updateOpeningHours,
  updateSeatCount,
} from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);
  if (session?.authLevel !== "admin") {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  const body = await readBody(request);
  const action = body.action;

  if (action === "createCompany") {
    const input = sanitizeCompanyInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const company = await createCompany(input);
    sendJson(response, 201, { message: "Company created.", company });
    return;
  }

  if (action === "updateCompany") {
    const input = sanitizeCompanyInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const company = await updateCompany(body.companyId, input);
    sendJson(response, 200, { message: "Company updated.", company });
    return;
  }

  if (action === "deleteCompany") {
    const result = await deleteCompany(body.companyId);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Company deleted." });
    return;
  }

  if (action === "bulkDeleteCompanies") {
    const result = await bulkDeleteCompanies(body.companyIds ?? []);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Selected companies deleted." });
    return;
  }

  if (action === "createEstablishment") {
    const input = sanitizeEstablishmentInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const establishment = await createEstablishment(input);
    sendJson(response, 201, { message: "Establishment created.", establishment });
    return;
  }

  if (action === "updateEstablishment") {
    const input = sanitizeEstablishmentInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const establishment = await updateEstablishment(body.establishmentId, input);
    sendJson(response, 200, { message: "Establishment updated.", establishment });
    return;
  }

  if (action === "deleteEstablishment") {
    const result = await deleteEstablishment(body.establishmentId);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Establishment deleted." });
    return;
  }

  if (action === "bulkDeleteEstablishments") {
    const result = await bulkDeleteEstablishments(body.establishmentIds ?? []);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Selected establishments deleted." });
    return;
  }

  if (action === "updateOpeningHours") {
    const input = sanitizeOpeningHoursInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    await updateOpeningHours(body.establishmentId, input.openingHours);
    sendJson(response, 200, { message: "Opening hours updated." });
    return;
  }

  if (action === "createSeatCount") {
    const input = sanitizeSeatCountInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const seatCount = await createSeatCount(input);
    sendJson(response, 201, { message: "Seat count created.", seatCount });
    return;
  }

  if (action === "updateSeatCount") {
    const input = sanitizeSeatCountInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const seatCount = await updateSeatCount(body.seatCountId, input);
    sendJson(response, 200, { message: "Seat count updated.", seatCount });
    return;
  }

  if (action === "deleteSeatCount") {
    const result = await deleteSeatCount(body.seatCountId);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Seat count deleted." });
    return;
  }

  if (action === "bulkDeleteSeatCounts") {
    const result = await bulkDeleteSeatCounts(body.seatCountIds ?? []);
    if (result.error) {
      sendJson(response, 400, { error: result.error });
      return;
    }

    sendJson(response, 200, { message: "Selected seat counts deleted." });
    return;
  }

  sendJson(response, 400, { error: "Unknown action." });
}
