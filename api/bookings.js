import {
  createBooking,
  clearSeatCountClosedDate,
  deleteBooking,
  deleteBookingsForEstablishment,
  getBooking,
  getSeatCountContext,
  listBookingReport,
  listSeatCountAvailability,
  searchBookingsForSeatCount,
  sanitizeBookingInput,
  setSeatCountClosedDate,
  updateBooking,
} from "../lib/bookings.js";
import { ensureSchema } from "../lib/db.js";
import { sendBookingConfirmationForBooking } from "../lib/email.js";
import { readBody, sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  try {
    await ensureSchema();
    const session = await getSessionUserFromCookieHeader(request.headers.cookie);
    const canAccessBookings = ["admin", "manager", "staff"].includes(session?.authLevel);

    if (!canAccessBookings) {
      sendJson(response, 403, { error: "Booking access required." });
      return;
    }

    if (request.method === "GET") {
      const url = new URL(request.url, "https://bookings.local");
      const action = url.searchParams.get("action") ?? "calendar";
      const seatCountId = url.searchParams.get("seatCountId");

      if (action === "calendar") {
        const seatCount = await getSeatCountContext(seatCountId);
        if (!seatCount) {
          sendJson(response, 400, { error: "Selected seat count does not exist." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const fromDate = url.searchParams.get("fromDate");
        const days = Number(url.searchParams.get("days") ?? 31);
        const availability = await listSeatCountAvailability(seatCountId, fromDate, days, {
          includeBookings: true,
        });

        if (availability.error) {
          sendJson(response, 400, { error: availability.error });
          return;
        }

        sendJson(response, 200, availability);
        return;
      }

      if (action === "booking") {
        const booking = await getBooking(url.searchParams.get("bookingId"));
        if (!booking) {
          sendJson(response, 404, { error: "Booking not found." });
          return;
        }

        if (!canAccessEstablishment(session, booking.establishmentId)) {
          sendJson(response, 403, { error: "That booking is outside your establishment access." });
          return;
        }

        sendJson(response, 200, { booking });
        return;
      }

      if (action === "search") {
        const seatCount = await getSeatCountContext(seatCountId);
        if (!seatCount) {
          sendJson(response, 400, { error: "Selected seat count does not exist." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const result = await searchBookingsForSeatCount(
          seatCountId,
          url.searchParams.get("query"),
          { limit: Number(url.searchParams.get("limit") ?? 20) },
        );

        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, result);
        return;
      }

      if (action === "report") {
        if (session.authLevel === "staff") {
          sendJson(response, 403, { error: "Staff cannot run booking reports." });
          return;
        }

        const seatCount = await getSeatCountContext(seatCountId);
        if (!seatCount) {
          sendJson(response, 400, { error: "Selected seat count does not exist." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const result = await listBookingReport(url.searchParams.get("seatCountId"), {
          fromDate: url.searchParams.get("fromDate"),
          toDate: url.searchParams.get("toDate"),
          fromTime: url.searchParams.get("fromTime"),
          toTime: url.searchParams.get("toTime"),
        });

        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 400, { error: "Unknown action." });
      return;
    }

    if (request.method === "POST") {
      const body = await readBody(request);
      const action = body.action ?? "create";

      if (action === "create") {
        const input = sanitizeBookingInput(body);
        if (input.error) {
          sendJson(response, 400, { error: input.error });
          return;
        }

        const seatCount = await getSeatCountContext(input.seatCountId);
        if (!seatCount) {
          sendJson(response, 400, { error: "Selected seat count does not exist." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
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
          bookingId: result.bookingId,
          confirmationEmailSent: emailResult.sent,
        });
        return;
      }

      if (action === "update") {
        const input = sanitizeBookingInput(body, { allowBookingId: true });
        if (input.error) {
          sendJson(response, 400, { error: input.error });
          return;
        }

        const seatCount = await getSeatCountContext(input.seatCountId);
        if (!seatCount) {
          sendJson(response, 400, { error: "Selected seat count does not exist." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const booking = await getBooking(input.bookingId);
        if (!booking) {
          sendJson(response, 404, { error: "Booking not found." });
          return;
        }

        if (!canAccessEstablishment(session, booking.establishmentId)) {
          sendJson(response, 403, { error: "That booking is outside your establishment access." });
          return;
        }

        const result = await updateBooking(input);
        if (result.error) {
          sendJson(response, 409, { error: result.error });
          return;
        }

        sendJson(response, 200, { message: "Booking updated." });
        return;
      }

      if (action === "delete") {
        const booking = await getBooking(body.bookingId);
        if (!booking) {
          sendJson(response, 404, { error: "Booking not found." });
          return;
        }

        if (!canAccessEstablishment(session, booking.establishmentId)) {
          sendJson(response, 403, { error: "That booking is outside your establishment access." });
          return;
        }

        const result = await deleteBooking(body.bookingId);
        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, { message: "Booking deleted." });
        return;
      }

      if (action === "deleteEstablishmentBookings") {
        if (session?.authLevel !== "admin") {
          sendJson(response, 403, { error: "Only admins can delete all bookings for an establishment." });
          return;
        }

        const establishmentId = String(body.establishmentId ?? "").trim();
        if (!establishmentId) {
          sendJson(response, 400, { error: "Establishment is required." });
          return;
        }

        const result = await deleteBookingsForEstablishment(establishmentId);
        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, {
          message:
            result.deletedCount > 0
              ? `${result.deletedCount} booking${result.deletedCount === 1 ? "" : "s"} deleted for that establishment.`
              : "No bookings were found for that establishment.",
          deletedCount: result.deletedCount,
        });
        return;
      }

      if (action === "closeDate") {
        if (!["admin", "manager"].includes(session?.authLevel)) {
          sendJson(response, 403, { error: "Only admins and managers can stop bookings for a day." });
          return;
        }

        const seatCount = await getSeatCountContext(body.seatCountId);
        const bookingDate = String(body.bookingDate ?? "").trim();
        if (!seatCount || !bookingDate) {
          sendJson(response, 400, { error: "Seat count and booking date are required." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const result = await setSeatCountClosedDate(body.seatCountId, bookingDate);
        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, { message: "No more bookings will be accepted for that day." });
        return;
      }

      if (action === "reopenDate") {
        if (!["admin", "manager"].includes(session?.authLevel)) {
          sendJson(response, 403, { error: "Only admins and managers can reopen a closed booking day." });
          return;
        }

        const seatCount = await getSeatCountContext(body.seatCountId);
        const bookingDate = String(body.bookingDate ?? "").trim();
        if (!seatCount || !bookingDate) {
          sendJson(response, 400, { error: "Seat count and booking date are required." });
          return;
        }

        if (!canAccessEstablishment(session, seatCount.establishmentId)) {
          sendJson(response, 403, { error: "That booking calendar is outside your establishment access." });
          return;
        }

        const result = await clearSeatCountClosedDate(body.seatCountId, bookingDate);
        if (result.error) {
          sendJson(response, 400, { error: result.error });
          return;
        }

        sendJson(response, 200, { message: "Bookings have been reopened for that day." });
        return;
      }

      sendJson(response, 400, { error: "Unknown action." });
      return;
    }

    sendJson(response, 405, { error: "Method not allowed." });
  } catch (error) {
    console.error("Bookings API failed", error);
    sendJson(response, 500, {
      error: `Bookings API failed: ${error.message ?? "Unknown error."}`,
    });
  }
}

function canAccessEstablishment(session, establishmentId) {
  if (session?.authLevel === "admin") {
    return true;
  }

  return Boolean(session?.establishmentId && establishmentId && session.establishmentId === establishmentId);
}

async function trySendBookingConfirmation(bookingId) {
  try {
    const result = await sendBookingConfirmationForBooking(bookingId);
    if (result.sent) {
      return {
        sent: true,
        message: "Booking created. A confirmation email has been sent.",
      };
    }

    console.warn("Admin booking confirmation email skipped", {
      bookingId,
      reason: result.reason ?? "Unknown reason.",
    });
  } catch (error) {
    console.error("Admin booking confirmation email failed", error);
  }

  return {
    sent: false,
    message: "Booking created. The confirmation email could not be sent.",
  };
}
