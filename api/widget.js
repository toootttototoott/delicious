import {
  createBooking,
  listSeatCountAvailability,
  listWidgetCatalog,
  sanitizeBookingInput,
} from "../lib/bookings.js";
import { ensureSchema } from "../lib/db.js";
import { sendBookingConfirmationForBooking } from "../lib/email.js";
import { readBody, sendJson } from "../lib/http.js";

export default async function handler(request, response) {
  await ensureSchema();

  if (request.method === "GET") {
    const url = new URL(request.url, "https://widget.local");
    const action = url.searchParams.get("action") ?? "config";

    if (action === "config") {
      const catalog = await listWidgetCatalog();
      sendJson(response, 200, { catalog });
      return;
    }

    if (action === "availability") {
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
    const input = sanitizeBookingInput(body);
    if (input.error) {
      sendJson(response, 400, { error: input.error });
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
