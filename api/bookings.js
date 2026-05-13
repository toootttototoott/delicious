import {
  createBooking,
  deleteBooking,
  getBooking,
  getSeatCountContext,
  listBookingReport,
  listSeatCountAvailability,
  searchBookingsForSeatCount,
  sanitizeBookingInput,
  updateBooking,
} from "../lib/bookings.js";
import { ensureSchema } from "../lib/db.js";
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

        sendJson(response, 201, { message: "Booking created.", bookingId: result.bookingId });
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
