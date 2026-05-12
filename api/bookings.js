import {
  createBooking,
  deleteBooking,
  getBooking,
  listSeatCountAvailability,
  sanitizeBookingInput,
  updateBooking,
} from "../lib/bookings.js";
import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  await ensureSchema();
  const session = await getSessionUserFromCookieHeader(request.headers.cookie);

  if (session?.authLevel !== "admin") {
    sendJson(response, 403, { error: "Admin access required." });
    return;
  }

  if (request.method === "GET") {
    const url = new URL(request.url, "https://bookings.local");
    const action = url.searchParams.get("action") ?? "calendar";

    if (action === "calendar") {
      const seatCountId = url.searchParams.get("seatCountId");
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

      sendJson(response, 200, { booking });
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

      const result = await updateBooking(input);
      if (result.error) {
        sendJson(response, 409, { error: result.error });
        return;
      }

      sendJson(response, 200, { message: "Booking updated." });
      return;
    }

    if (action === "delete") {
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
}
