import { pool } from "./db.js";
import { decryptText, encryptText } from "./security.js";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export async function listWidgetCatalog() {
  const [companiesResult, establishmentsResult, seatCountsResult, widgetThemesResult] = await Promise.all([
    pool.query("SELECT id, name FROM companies ORDER BY name ASC"),
    pool.query("SELECT id, company_id, name FROM establishments ORDER BY name ASC"),
    pool.query(
      "SELECT id, establishment_id, seat_count FROM establishment_seat_counts ORDER BY seat_count ASC",
    ),
    pool.query(
      `SELECT establishment_id, widget_key, css_text, updated_at
       FROM establishment_widget_themes
       WHERE widget_key = 'booking_calendar'
       ORDER BY establishment_id ASC`,
    ),
  ]);

  const seatCountsByEstablishment = new Map();
  for (const row of seatCountsResult.rows) {
    const existing = seatCountsByEstablishment.get(row.establishment_id) ?? [];
    existing.push({
      id: row.id,
      establishmentId: row.establishment_id,
      seatCount: Number(row.seat_count),
      label: `${Number(row.seat_count)} seats`,
    });
    seatCountsByEstablishment.set(row.establishment_id, existing);
  }

  const widgetThemeByEstablishment = new Map();
  for (const row of widgetThemesResult.rows) {
    widgetThemeByEstablishment.set(row.establishment_id, {
      widgetKey: row.widget_key,
      cssText: row.css_text ?? "",
      updatedAt: row.updated_at ?? null,
    });
  }

  const establishmentsByCompany = new Map();
  for (const row of establishmentsResult.rows) {
    const existing = establishmentsByCompany.get(row.company_id) ?? [];
    existing.push({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      widgetTheme: widgetThemeByEstablishment.get(row.id) ?? {
        widgetKey: "booking_calendar",
        cssText: "",
        updatedAt: null,
      },
      seatCounts: seatCountsByEstablishment.get(row.id) ?? [],
    });
    establishmentsByCompany.set(row.company_id, existing);
  }

  return companiesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    establishments: establishmentsByCompany.get(row.id) ?? [],
  }));
}

export async function listSeatCountAvailability(seatCountId, fromDate, days = 31, options = {}) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  if (!normalizedSeatCountId) {
    return { error: "Invalid seat count." };
  }

  const startDate = normalizeDate(fromDate);
  if (!startDate) {
    return { error: "Invalid date." };
  }

  const normalizedDays = Math.max(1, Math.min(Number(days) || 31, 62));
  const seatCount = await getSeatCountContext(normalizedSeatCountId);
  if (!seatCount) {
    return { error: "Selected seat count does not exist." };
  }

  const openingHours = await getOpeningHoursByEstablishment(seatCount.establishmentId);
  const dateWindow = buildDateWindow(startDate, normalizedDays);
  const endDate = dateWindow[dateWindow.length - 1];
  const bookings = await listBookingsForSeatCountRange(normalizedSeatCountId, startDate, endDate);
  const bookingsByDateTime = groupBookingsByDateTime(bookings);

  return {
    seatCountId: normalizedSeatCountId,
    seatCount: seatCount.seatCount,
    dates: dateWindow.map((date) =>
      buildAvailabilityForDate({
        date,
        seatCount,
        openingHours,
        bookingsByDateTime,
        includeBookings: options.includeBookings === true,
      }),
    ),
  };
}

export function sanitizeBookingInput(body, options = {}) {
  const allowBookingId = options.allowBookingId === true;
  const seatCountId = normalizeId(body.seatCountId);
  const bookingDate = normalizeDate(body.bookingDate);
  const bookingTime = normalizeTime(body.bookingTime);
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const partySize = Number(body.partySize);
  const bookingId = allowBookingId ? normalizeId(body.bookingId) : null;

  if (!seatCountId || !bookingDate || !bookingTime) {
    return { error: "Seat count, date, and time are required." };
  }

  if (!firstName || !lastName || !email || !phone) {
    return { error: "First name, last name, email, and phone are required." };
  }

  if (!Number.isInteger(partySize) || partySize <= 0) {
    return { error: "Number of people must be a positive whole number." };
  }

  if (allowBookingId && !bookingId) {
    return { error: "Invalid booking id." };
  }

  return {
    bookingId,
    seatCountId,
    bookingDate,
    bookingTime,
    firstName,
    lastName,
    email,
    phone,
    notes,
    partySize,
  };
}

export async function createBooking(input) {
  const seatCount = await getSeatCountContext(input.seatCountId);
  if (!seatCount) {
    return { error: "Selected seat count does not exist." };
  }

  const validation = await validateBookingSlot(input, seatCount, null);
  if (validation.error) {
    return validation;
  }

  const result = await pool.query(
    `INSERT INTO bookings (
       seat_count_id,
       establishment_id,
       booking_date,
       booking_time,
       party_size,
       customer_first_name_encrypted,
       customer_last_name_encrypted,
       customer_email_encrypted,
       customer_phone_encrypted,
       notes_encrypted
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id`,
    [
      input.seatCountId,
      seatCount.establishmentId,
      input.bookingDate,
      input.bookingTime,
      input.partySize,
      encryptText(input.firstName),
      encryptText(input.lastName),
      encryptText(input.email),
      encryptText(input.phone),
      encryptText(input.notes),
    ],
  );

  return {
    ok: true,
    bookingId: result.rows[0].id,
    bookingDate: input.bookingDate,
    bookingTime: input.bookingTime,
  };
}

export async function updateBooking(input) {
  const seatCount = await getSeatCountContext(input.seatCountId);
  if (!seatCount) {
    return { error: "Selected seat count does not exist." };
  }

  const existing = await pool.query("SELECT id FROM bookings WHERE id = $1", [input.bookingId]);
  if (!existing.rows[0]) {
    return { error: "Booking not found." };
  }

  const validation = await validateBookingSlot(input, seatCount, input.bookingId);
  if (validation.error) {
    return validation;
  }

  await pool.query(
    `UPDATE bookings
     SET
       seat_count_id = $1,
       establishment_id = $2,
       booking_date = $3,
       booking_time = $4,
       party_size = $5,
       customer_first_name_encrypted = $6,
       customer_last_name_encrypted = $7,
       customer_email_encrypted = $8,
       customer_phone_encrypted = $9,
       notes_encrypted = $10,
       updated_at = now()
     WHERE id = $11`,
    [
      input.seatCountId,
      seatCount.establishmentId,
      input.bookingDate,
      input.bookingTime,
      input.partySize,
      encryptText(input.firstName),
      encryptText(input.lastName),
      encryptText(input.email),
      encryptText(input.phone),
      encryptText(input.notes),
      input.bookingId,
    ],
  );

  return { ok: true };
}

export async function deleteBooking(bookingId) {
  const normalizedBookingId = normalizeId(bookingId);
  if (!normalizedBookingId) {
    return { error: "Invalid booking id." };
  }

  await pool.query("DELETE FROM bookings WHERE id = $1", [normalizedBookingId]);
  return { ok: true };
}

export async function getBooking(bookingId) {
  const normalizedBookingId = normalizeId(bookingId);
  if (!normalizedBookingId) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       b.id,
       b.seat_count_id,
       b.establishment_id,
       b.booking_date,
       b.booking_time,
       b.party_size,
       b.customer_first_name_encrypted,
       b.customer_last_name_encrypted,
       b.customer_email_encrypted,
       b.customer_phone_encrypted,
       b.notes_encrypted
     FROM bookings b
     WHERE b.id = $1`,
    [normalizedBookingId],
  );

  return result.rows[0] ? presentBooking(result.rows[0]) : null;
}

export async function searchBookingsForSeatCount(seatCountId, query, options = {}) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  const normalizedQuery = String(query ?? "").trim().toLowerCase();
  const limit = Math.max(1, Math.min(Number(options.limit) || 20, 100));

  if (!normalizedSeatCountId) {
    return { error: "Invalid seat count." };
  }

  if (!normalizedQuery) {
    return { results: [] };
  }

  const seatCount = await getSeatCountContext(normalizedSeatCountId);
  if (!seatCount) {
    return { error: "Selected seat count does not exist." };
  }

  const bookings = await listBookingsForSeatCount(normalizedSeatCountId);
  const results = bookings
    .filter((booking) => buildBookingSearchText(booking).includes(normalizedQuery))
    .slice(0, limit);

  return {
    seatCountId: normalizedSeatCountId,
    results,
  };
}

export async function listBookingReport(seatCountId, filters = {}) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  const fromDate = normalizeDate(filters.fromDate);
  const toDate = normalizeDate(filters.toDate);
  const fromTime = filters.fromTime ? normalizeTime(filters.fromTime) : "";
  const toTime = filters.toTime ? normalizeTime(filters.toTime) : "";

  if (!normalizedSeatCountId) {
    return { error: "Invalid seat count." };
  }

  if (!fromDate || !toDate) {
    return { error: "Start date and end date are required." };
  }

  if (fromDate > toDate) {
    return { error: "Start date must be on or before end date." };
  }

  if ((filters.fromTime && !fromTime) || (filters.toTime && !toTime)) {
    return { error: "Time filters are invalid." };
  }

  if (fromTime && toTime && fromTime > toTime) {
    return { error: "Start time must be on or before end time." };
  }

  const seatCount = await getSeatCountContext(normalizedSeatCountId);
  if (!seatCount) {
    return { error: "Selected seat count does not exist." };
  }

  const bookings = await listBookingsForSeatCount(normalizedSeatCountId, {
    fromDate,
    toDate,
    fromTime,
    toTime,
  });

  return {
    seatCountId: normalizedSeatCountId,
    fromDate,
    toDate,
    fromTime,
    toTime,
    totalBookings: bookings.length,
    totalGuests: bookings.reduce((sum, booking) => sum + Number(booking.partySize || 0), 0),
    bookings,
  };
}

export async function validateBookingSlot(input, seatCount, excludeBookingId) {
  const weekdayIndex = dateToWeekdayIndex(input.bookingDate);
  const openingHours = await getOpeningHoursByEstablishment(seatCount.establishmentId);
  const dayHours = openingHours.get(weekdayIndex);

  if (!dayHours?.isOpen) {
    return { error: "That day is closed." };
  }

  const validTimes = buildTimeSlots(dayHours.openTime, dayHours.closeTime);
  if (!validTimes.includes(input.bookingTime)) {
    return { error: "That time is outside opening hours." };
  }

  if (input.partySize > seatCount.seatCount) {
    return { error: `This calendar only has ${seatCount.seatCount} seats.` };
  }

  const params = [input.seatCountId, input.bookingDate, input.bookingTime];
  let query = `
    SELECT COALESCE(sum(party_size), 0)::INT AS booked
    FROM bookings
    WHERE seat_count_id = $1
      AND booking_date = $2
      AND booking_time = $3
  `;

  if (excludeBookingId) {
    params.push(excludeBookingId);
    query += " AND id != $4";
  }

  const result = await pool.query(query, params);
  const booked = Number(result.rows[0]?.booked ?? 0);
  const remaining = seatCount.seatCount - booked;

  if (input.partySize > remaining) {
    return { error: `Only ${Math.max(remaining, 0)} seats remain for that time.` };
  }

  return { ok: true };
}

export function buildTimeSlots(openTime, closeTime) {
  if (!normalizeTime(openTime) || !normalizeTime(closeTime)) {
    return [];
  }

  const slots = [];
  let current = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);

  while (current < end) {
    slots.push(minutesToTime(current));
    current += 60;
  }

  return slots;
}

function buildAvailabilityForDate({ date, seatCount, openingHours, bookingsByDateTime, includeBookings }) {
  const weekdayIndex = dateToWeekdayIndex(date);
  const dayHours = openingHours.get(weekdayIndex) ?? {
    weekdayIndex,
    label: WEEKDAY_LABELS[weekdayIndex],
    isOpen: false,
    openTime: "",
    closeTime: "",
  };

  const slotTimes = dayHours.isOpen ? buildTimeSlots(dayHours.openTime, dayHours.closeTime) : [];
  const slots = slotTimes.map((time) => {
    const bookings = bookingsByDateTime.get(`${date}|${time}`) ?? [];
    const booked = bookings.reduce((sum, booking) => sum + booking.partySize, 0);
    const remaining = Math.max(seatCount.seatCount - booked, 0);

    return {
      time,
      capacity: seatCount.seatCount,
      booked,
      remaining,
      available: remaining > 0,
      bookings: includeBookings ? bookings : undefined,
    };
  });

  const minRemaining = slots.length
    ? slots.reduce((min, slot) => Math.min(min, slot.remaining), seatCount.seatCount)
    : 0;
  const maxRemaining = slots.reduce((max, slot) => Math.max(max, slot.remaining), 0);

  return {
    date,
    isOpen: dayHours.isOpen,
    openTime: dayHours.openTime,
    closeTime: dayHours.closeTime,
    capacity: seatCount.seatCount,
    remaining: dayHours.isOpen ? maxRemaining : 0,
    minRemaining: dayHours.isOpen ? minRemaining : 0,
    slots,
  };
}

async function listBookingsForSeatCountRange(seatCountId, startDate, endDate) {
  return listBookingsForSeatCount(seatCountId, {
    fromDate: startDate,
    toDate: endDate,
  });
}

async function listBookingsForSeatCount(seatCountId, options = {}) {
  const params = [seatCountId];
  const where = ["seat_count_id = $1"];

  if (options.fromDate) {
    params.push(options.fromDate);
    where.push(`booking_date >= $${params.length}`);
  }

  if (options.toDate) {
    params.push(options.toDate);
    where.push(`booking_date <= $${params.length}`);
  }

  if (options.fromTime) {
    params.push(options.fromTime);
    where.push(`booking_time >= $${params.length}`);
  }

  if (options.toTime) {
    params.push(options.toTime);
    where.push(`booking_time <= $${params.length}`);
  }

  const result = await pool.query(
    `SELECT
       id,
       seat_count_id,
       establishment_id,
       booking_date,
       booking_time,
       party_size,
       customer_first_name_encrypted,
       customer_last_name_encrypted,
       customer_email_encrypted,
       customer_phone_encrypted,
       notes_encrypted
     FROM bookings
     WHERE ${where.join("\n       AND ")}
     ORDER BY booking_date ASC, booking_time ASC, created_at ASC`,
    params,
  );

  return result.rows.map(safePresentBooking);
}

async function getSeatCountContext(seatCountId) {
  const result = await pool.query(
    `SELECT id, establishment_id, seat_count
     FROM establishment_seat_counts
     WHERE id = $1`,
    [seatCountId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        establishmentId: result.rows[0].establishment_id,
        seatCount: Number(result.rows[0].seat_count),
      }
    : null;
}

async function getOpeningHoursByEstablishment(establishmentId) {
  const result = await pool.query(
    `SELECT weekday_index, is_open, open_time, close_time
     FROM establishment_opening_hours
     WHERE establishment_id = $1
     ORDER BY weekday_index ASC`,
    [establishmentId],
  );

  const map = new Map();
  for (const row of result.rows) {
    map.set(Number(row.weekday_index), {
      weekdayIndex: Number(row.weekday_index),
      label: WEEKDAY_LABELS[Number(row.weekday_index)] ?? "",
      isOpen: Boolean(row.is_open),
      openTime: row.open_time ?? "",
      closeTime: row.close_time ?? "",
    });
  }

  for (let weekdayIndex = 0; weekdayIndex < WEEKDAY_LABELS.length; weekdayIndex += 1) {
    if (!map.has(weekdayIndex)) {
      map.set(weekdayIndex, {
        weekdayIndex,
        label: WEEKDAY_LABELS[weekdayIndex],
        isOpen: false,
        openTime: "",
        closeTime: "",
      });
    }
  }

  return map;
}

function groupBookingsByDateTime(bookings) {
  const map = new Map();
  for (const booking of bookings) {
    const key = `${booking.bookingDate}|${booking.bookingTime}`;
    const existing = map.get(key) ?? [];
    existing.push(booking);
    map.set(key, existing);
  }
  return map;
}

function presentBooking(row) {
  return {
    id: row.id,
    seatCountId: row.seat_count_id,
    establishmentId: row.establishment_id,
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
    partySize: Number(row.party_size ?? 1),
    firstName: decryptText(row.customer_first_name_encrypted),
    lastName: decryptText(row.customer_last_name_encrypted),
    email: decryptText(row.customer_email_encrypted),
    phone: decryptText(row.customer_phone_encrypted),
    notes: decryptText(row.notes_encrypted),
  };
}

function safePresentBooking(row) {
  try {
    return presentBooking(row);
  } catch (error) {
    return {
      id: row.id,
      seatCountId: row.seat_count_id,
      establishmentId: row.establishment_id,
      bookingDate: row.booking_date,
      bookingTime: row.booking_time,
      partySize: Number(row.party_size ?? 1),
      firstName: "Unreadable",
      lastName: "booking",
      email: "current key cannot decrypt",
      phone: "current key cannot decrypt",
      notes: "This row was encrypted with a different key or has invalid stored data.",
      unreadable: true,
    };
  }
}

function buildBookingSearchText(booking) {
  return [
    booking.firstName,
    booking.lastName,
    booking.email,
    booking.phone,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join(" ");
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeDate(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeTime(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function buildDateWindow(startDate, days) {
  const result = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);

  for (let index = 0; index < days; index += 1) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function dateToWeekdayIndex(date) {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
}

function timeToMinutes(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(value) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
