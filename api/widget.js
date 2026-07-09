import {
  createBooking,
  getSeatCountContext,
  getPublicWidgetCatalogForSeatCount,
  listSeatCountAvailability,
  sanitizeBookingInput,
} from "../lib/bookings.js";
import { listCompaniesTreeForSession } from "../lib/companies.js";
import { ensureSchema } from "../lib/db.js";
import {
  sanitizeBookingEnquiryInput,
  sendBookingConfirmationForBooking,
  sendBookingEnquiryEmail,
} from "../lib/email.js";
import { readBody, sendJson } from "../lib/http.js";
import {
  sanitizePublicFormSubmissionMeta,
  validatePublicFormSubmissionMeta,
} from "../lib/public-form.js";
import { checkRateLimit, getClientIp } from "../lib/rate-limit.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const clientIp = getClientIp(request);

  if (request.method === "GET") {
    const url = new URL(request.url, "https://widget.local");
    const action = url.searchParams.get("action") ?? "config";

    if (action === "config") {
      const requestedSeatCountId = url.searchParams.get("seatCountId");
      if (requestedSeatCountId) {
        if (isRateLimited(response, [`widget-config:${clientIp}`, `widget-config-seat:${requestedSeatCountId}`], {
          windowMs: 5 * 60 * 1000,
          maxAttempts: 120,
          blockMs: 5 * 60 * 1000,
        })) {
          return;
        }

        const config = await getPublicWidgetCatalogForSeatCount(requestedSeatCountId);
        if (config.error) {
          sendJson(response, 400, { error: config.error });
          return;
        }

        sendJson(response, 200, config);
        return;
      }

      const session = await getSessionUserFromCookieHeader(request.headers.cookie);
      if (!["admin", "manager", "staff"].includes(session?.authLevel)) {
        sendJson(response, 403, { error: "A seat-count calendar is required." });
        return;
      }

      const catalog = await listCompaniesTreeForSession(session);
      sendJson(response, 200, { catalog });
      return;
    }

    if (action === "availability") {
      if (isRateLimited(response, [`widget-availability:${clientIp}`], {
        windowMs: 5 * 60 * 1000,
        maxAttempts: 240,
        blockMs: 5 * 60 * 1000,
      })) {
        return;
      }

      const seatCountId = url.searchParams.get("seatCountId");
      const fromDate = url.searchParams.get("fromDate");
      const days = Number(url.searchParams.get("days") ?? 31);
      const availability = await listSeatCountAvailability(seatCountId, fromDate, days);

      if (availability.error) {
        sendJson(response, 400, { error: availability.error });
        return;
      }

      sendJson(response, 200, availability);
      return;
    }

    sendJson(response, 400, { error: "Unknown action." });
    return;
  }

  if (request.method === "POST") {
    const body = await readBody(request);
    const action = body.action ?? "create";

    if (action === "enquiry") {
      if (isRateLimited(response, [`widget-enquiry:${clientIp}`], {
        windowMs: 15 * 60 * 1000,
        maxAttempts: 12,
        blockMs: 30 * 60 * 1000,
      })) {
        return;
      }

      const config = await getPublicWidgetCatalogForSeatCount(body.seatCountId);
      if (config.error) {
        sendJson(response, 400, { error: config.error });
        return;
      }

      const publicFormMeta = sanitizePublicFormSubmissionMeta(body);
      const publicFormValidation = validatePublicFormSubmissionMeta(publicFormMeta);
      if (publicFormValidation.error) {
        sendJson(response, 400, { error: publicFormValidation.error });
        return;
      }

      const company = config.catalog?.[0] ?? null;
      const establishment = company?.establishments?.[0] ?? null;
      const input = sanitizeBookingEnquiryInput({
        ...body,
        recipientEmail: company?.enquiryEmail ?? "",
        companyName: company?.name ?? "",
        establishmentName: establishment?.name ?? "",
      });
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const result = await trySendBookingEnquiry(input);
      if (!result.sent) {
        sendJson(response, 400, { error: result.reason ?? "Enquiry email could not be sent." });
        return;
      }

      sendJson(response, 201, { message: "Your enquiry has been sent." });
      return;
    }

    if (isRateLimited(response, [`widget-booking:${clientIp}`], {
      windowMs: 15 * 60 * 1000,
      maxAttempts: 12,
      blockMs: 30 * 60 * 1000,
    })) {
      return;
    }

    const input = sanitizeBookingInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
      return;
    }

    const publicFormMeta = sanitizePublicFormSubmissionMeta(body);
    const publicFormValidation = validatePublicFormSubmissionMeta(publicFormMeta);
    if (publicFormValidation.error) {
      sendJson(response, 400, { error: publicFormValidation.error });
      return;
    }

    const seatCount = await getSeatCountContext(input.seatCountId);
    if (!seatCount) {
      sendJson(response, 400, { error: "Selected seat count does not exist." });
      return;
    }

    if (input.partySize > seatCount.maxPartySize) {
      sendJson(response, 400, {
        error: `For parties over ${seatCount.maxPartySize}, enquire here instead.`,
      });
      return;
    }

    const result = await createBooking(input);
    if (result.error) {
      sendJson(response, 409, { error: result.error });
      return;
    }

    const emailResult = await trySendBookingConfirmation(result.bookingId);
    sendJson(response, 201, {
      message: emailResult.message,
      bookingDate: result.bookingDate,
      bookingTime: result.bookingTime,
      bookingId: result.bookingId,
      confirmationEmailSent: emailResult.sent,
    });
    return;
  }

  sendJson(response, 405, { error: "Method not allowed." });
}

async function trySendBookingConfirmation(bookingId) {
  try {
    const result = await sendBookingConfirmationForBooking(bookingId);
    if (result.sent) {
      return {
        sent: true,
        message: "Booking confirmed. A confirmation email has been sent.",
      };
    }

    console.warn("Booking confirmation email skipped", {
      bookingId,
      reason: result.reason ?? "Unknown reason.",
    });
  } catch (error) {
    console.error("Booking confirmation email failed", error);
  }

  return {
    sent: false,
    message: "Booking confirmed. The confirmation email could not be sent.",
  };
}

async function trySendBookingEnquiry(input) {
  try {
    return await sendBookingEnquiryEmail(input);
  } catch (error) {
    console.error("Booking enquiry email failed", error);
    return {
      sent: false,
      reason: "Enquiry email could not be sent.",
    };
  }
}

function isRateLimited(response, keys, options) {
  for (const key of keys) {
    const result = checkRateLimit(key, options);
    if (result.limited) {
      sendJson(
        response,
        429,
        { error: "Too many requests. Please wait and try again." },
        { "Retry-After": String(result.retryAfterSeconds) },
      );
      return true;
    }
  }

  return false;
}
