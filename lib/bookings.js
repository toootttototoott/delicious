import { pool } from "./db.js";
import { decryptText, encryptText } from "./security.js";
import { BOOKING_PAGE_VIEW_KEY, BOOKING_WIDGET_KEY } from "./widget-themes.js";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SLOT_INTERVAL_MINUTES = 15;
export const DEFAULT_GUEST_VISIT_MINUTES = 90;
export const DEFAULT_MAX_PARTY_SIZE = 40;

export async function listWidgetCatalog() {
  const [companiesResult, establishmentsResult, seatCountsResult, widgetThemesResult] = await Promise.all([
    pool.query("SELECT id, name, enquiry_email FROM companies ORDER BY name ASC"),
    pool.query("SELECT id, company_id, name FROM establishments ORDER BY name ASC"),
    pool.query(
      `SELECT id, establishment_id, seat_count, guest_visit_minutes, max_party_size
       FROM establishment_seat_counts
       ORDER BY seat_count ASC`,
    ),
    pool.query(
      `SELECT establishment_id, widget_key, css_text, content_json, updated_at
       FROM establishment_widget_themes
       WHERE widget_key IN ($1, $2)
       ORDER BY establishment_id ASC, widget_key ASC`,
      [BOOKING_WIDGET_KEY, BOOKING_PAGE_VIEW_KEY],
    ),
  ]);

  const seatCountsByEstablishment = new Map();
  for (const row of seatCountsResult.rows) {
    const existing = seatCountsByEstablishment.get(row.establishment_id) ?? [];
    existing.push({
      id: row.id,
      establishmentId: row.establishment_id,
      seatCount: Number(row.seat_count),
      guestVisitMinutes: normalizeGuestVisitMinutes(row.guest_visit_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
      maxPartySize: normalizeMaxPartySize(row.max_party_size, row.seat_count),
      label: `${Number(row.seat_count)} seats`,
    });
    seatCountsByEstablishment.set(row.establishment_id, existing);
  }

  const themesByEstablishment = new Map();
  for (const row of widgetThemesResult.rows) {
    const existing = themesByEstablishment.get(row.establishment_id) ?? new Map();
    existing.set(row.widget_key, {
      widgetKey: row.widget_key,
      cssText: row.css_text ?? "",
      contentText: row.content_json ?? "",
      updatedAt: row.updated_at ?? null,
    });
    themesByEstablishment.set(row.establishment_id, existing);
  }

  const establishmentsByCompany = new Map();
  for (const row of establishmentsResult.rows) {
    const existing = establishmentsByCompany.get(row.company_id) ?? [];
    const themes = themesByEstablishment.get(row.id) ?? new Map();
    existing.push({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
      widgetTheme: themes.get(BOOKING_WIDGET_KEY) ?? {
        widgetKey: BOOKING_WIDGET_KEY,
        cssText: "",
        contentText: "",
        updatedAt: null,
      },
      pageViewTheme: themes.get(BOOKING_PAGE_VIEW_KEY) ?? {
        widgetKey: BOOKING_PAGE_VIEW_KEY,
        cssText: "",
        contentText: "",
        updatedAt: null,
      },
      seatCounts: seatCountsByEstablishment.get(row.id) ?? [],
    });
    establishmentsByCompany.set(row.company_id, existing);
  }

  return companiesResult.rows.map((row) => ({
    id: row.id,
    name: row.name,
    enquiryEmail: row.enquiry_email ?? "",
    establishments: establishmentsByCompany.get(row.id) ?? [],
  }));
}

export async function getPublicWidgetCatalogForSeatCount(seatCountId) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  if (!normalizedSeatCountId) {
    return { error: "Invalid seat count." };
  }

  const seatCountResult = await pool.query(
    `SELECT
       sc.id,
       sc.establishment_id,
       sc.seat_count,
       sc.guest_visit_minutes,
       sc.max_party_size,
       e.name AS establishment_name,
       e.company_id,
       c.name AS company_name,
       c.enquiry_email AS company_enquiry_email
     FROM establishment_seat_counts sc
     JOIN establishments e
       ON e.id = sc.establishment_id
     JOIN companies c
       ON c.id = e.company_id
     WHERE sc.id = $1`,
    [normalizedSeatCountId],
  );

  const seatCountRow = seatCountResult.rows[0];
  if (!seatCountRow) {
    return { error: "Selected seat count does not exist." };
  }

  const widgetThemesResult = await pool.query(
    `SELECT establishment_id, widget_key, css_text, content_json, updated_at
     FROM establishment_widget_themes
     WHERE establishment_id = $1
       AND widget_key IN ($2, $3)
     ORDER BY widget_key ASC`,
    [seatCountRow.establishment_id, BOOKING_WIDGET_KEY, BOOKING_PAGE_VIEW_KEY],
  );

  const themes = new Map();
  for (const row of widgetThemesResult.rows) {
    themes.set(row.widget_key, {
      widgetKey: row.widget_key,
      cssText: row.css_text ?? "",
      contentText: row.content_json ?? "",
      updatedAt: row.updated_at ?? null,
    });
  }

  return {
    catalog: [
      {
        id: seatCountRow.company_id,
        name: seatCountRow.company_name,
        enquiryEmail: seatCountRow.company_enquiry_email ?? "",
        establishments: [
          {
            id: seatCountRow.establishment_id,
            companyId: seatCountRow.company_id,
            name: seatCountRow.establishment_name,
            widgetTheme: themes.get(BOOKING_WIDGET_KEY) ?? {
              widgetKey: BOOKING_WIDGET_KEY,
              cssText: "",
              contentText: "",
              updatedAt: null,
            },
            pageViewTheme: themes.get(BOOKING_PAGE_VIEW_KEY) ?? {
              widgetKey: BOOKING_PAGE_VIEW_KEY,
              cssText: "",
              contentText: "",
              updatedAt: null,
            },
            seatCounts: [
              {
                id: seatCountRow.id,
                establishmentId: seatCountRow.establishment_id,
                seatCount: Number(seatCountRow.seat_count),
                guestVisitMinutes:
                  normalizeGuestVisitMinutes(seatCountRow.guest_visit_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
                maxPartySize: normalizeMaxPartySize(seatCountRow.max_party_size, seatCountRow.seat_count),
                label: `${Number(seatCountRow.seat_count)} seats`,
              },
            ],
          },
        ],
      },
    ],
  };
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
  const closedDates = await listClosedDatesForSeatCountRange(normalizedSeatCountId, startDate, endDate);
  const bookingsByDateTime = groupBookingsByDateTime(bookings);

  return {
    seatCountId: normalizedSeatCountId,
    seatCount: seatCount.seatCount,
    dates: dateWindow.map((date) =>
      buildAvailabilityForDate({
        date,
        seatCount,
        openingHours,
        closedDates,
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
       visit_duration_minutes,
       customer_first_name_encrypted,
       customer_last_name_encrypted,
       customer_email_encrypted,
       customer_phone_encrypted,
       notes_encrypted
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      input.seatCountId,
      seatCount.establishmentId,
      input.bookingDate,
      input.bookingTime,
      input.partySize,
      seatCount.guestVisitMinutes,
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
       visit_duration_minutes = $6,
       customer_first_name_encrypted = $7,
       customer_last_name_encrypted = $8,
       customer_email_encrypted = $9,
       customer_phone_encrypted = $10,
       notes_encrypted = $11,
       updated_at = now()
     WHERE id = $12`,
    [
      input.seatCountId,
      seatCount.establishmentId,
      input.bookingDate,
      input.bookingTime,
      input.partySize,
      seatCount.guestVisitMinutes,
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

export async function deleteBookingsForEstablishment(establishmentId) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    return { error: "Invalid establishment id." };
  }

  const result = await pool.query(
    `DELETE FROM bookings
     WHERE establishment_id = $1
     RETURNING id`,
    [normalizedEstablishmentId],
  );

  return {
    ok: true,
    deletedCount: result.rowCount ?? result.rows.length ?? 0,
  };
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
       b.visit_duration_minutes,
       b.customer_first_name_encrypted,
       b.customer_last_name_encrypted,
       b.customer_email_encrypted,
       b.customer_phone_encrypted,
       b.notes_encrypted,
       sc.seat_count,
       e.name AS establishment_name,
       c.name AS company_name
     FROM bookings b
     LEFT JOIN establishment_seat_counts sc
       ON sc.id = b.seat_count_id
     LEFT JOIN establishments e
       ON e.id = b.establishment_id
     LEFT JOIN companies c
       ON c.id = e.company_id
     WHERE b.id = $1`,
    [normalizedBookingId],
  );

  return result.rows[0] ? safePresentBooking(result.rows[0]) : null;
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

export async function setSeatCountClosedDate(seatCountId, bookingDate) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  const normalizedDate = normalizeDate(bookingDate);

  if (!normalizedSeatCountId || !normalizedDate) {
    return { error: "Seat count and booking date are required." };
  }

  await pool.query(
    `UPSERT INTO seat_count_closed_dates (seat_count_id, booking_date, updated_at)
     VALUES ($1, $2, now())`,
    [normalizedSeatCountId, normalizedDate],
  );

  return { ok: true };
}

export async function clearSeatCountClosedDate(seatCountId, bookingDate) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  const normalizedDate = normalizeDate(bookingDate);

  if (!normalizedSeatCountId || !normalizedDate) {
    return { error: "Seat count and booking date are required." };
  }

  await pool.query(
    `DELETE FROM seat_count_closed_dates
     WHERE seat_count_id = $1
       AND booking_date = $2`,
    [normalizedSeatCountId, normalizedDate],
  );

  return { ok: true };
}

export async function validateBookingSlot(input, seatCount, excludeBookingId) {
  const weekdayIndex = dateToWeekdayIndex(input.bookingDate);
  const openingHours = await getOpeningHoursByEstablishment(seatCount.establishmentId);
  const dayHours = openingHours.get(weekdayIndex);
  const isClosedDate = await isSeatCountDateClosed(input.seatCountId, input.bookingDate);

  if (isClosedDate) {
    if (!excludeBookingId) {
      return { error: "No more bookings are being taken for that day." };
    }

    const existing = await pool.query(
      `SELECT seat_count_id, booking_date
       FROM bookings
       WHERE id = $1`,
      [excludeBookingId],
    );
    const existingBooking = existing.rows[0];
    const isSameBlockedDay =
      existingBooking?.seat_count_id === input.seatCountId &&
      existingBooking?.booking_date === input.bookingDate;

    if (!isSameBlockedDay) {
      return { error: "No more bookings are being taken for that day." };
    }
  }

  if (!dayHours?.isOpen) {
    return { error: "That day is closed." };
  }

  const validTimes = buildBookableStartTimes(dayHours.openTime, dayHours.closeTime, seatCount.guestVisitMinutes);
  if (!validTimes.includes(input.bookingTime)) {
    return { error: "That time is outside opening hours." };
  }

  if (input.partySize > seatCount.seatCount) {
    return { error: `This calendar only has ${seatCount.seatCount} seats.` };
  }

  const bookings = await listBookingsForSeatCount(input.seatCountId, {
    fromDate: input.bookingDate,
    toDate: input.bookingDate,
  });
  const concurrentBooked = getPeakOccupiedSeatsForBookingWindow(
    bookings.filter((booking) => booking.id !== excludeBookingId),
    input.bookingTime,
    seatCount.guestVisitMinutes,
  );
  const remaining = seatCount.seatCount - concurrentBooked;

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
    current += SLOT_INTERVAL_MINUTES;
  }

  return slots;
}

export function normalizeGuestVisitMinutes(value) {
  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0 || numeric % SLOT_INTERVAL_MINUTES !== 0) {
    return null;
  }

  return numeric;
}

export function normalizeMaxPartySize(value, seatCount = null) {
  const numeric = Number(value);
  const capacity = Number(seatCount);

  if (!Number.isInteger(numeric) || numeric <= 0) {
    if (Number.isInteger(capacity) && capacity > 0) {
      return capacity;
    }

    return DEFAULT_MAX_PARTY_SIZE;
  }

  if (Number.isInteger(capacity) && capacity > 0) {
    return Math.min(numeric, capacity);
  }

  return numeric;
}

export function buildBookableStartTimes(openTime, closeTime, guestVisitMinutes = DEFAULT_GUEST_VISIT_MINUTES) {
  if (!normalizeTime(openTime) || !normalizeTime(closeTime)) {
    return [];
  }

  const duration = normalizeGuestVisitMinutes(guestVisitMinutes) ?? DEFAULT_GUEST_VISIT_MINUTES;
  const slots = [];
  let current = timeToMinutes(openTime);
  const end = timeToMinutes(closeTime);

  while (current + duration <= end) {
    slots.push(minutesToTime(current));
    current += SLOT_INTERVAL_MINUTES;
  }

  return slots;
}

function getPeakOccupiedSeatsForBookingWindow(bookings, candidateTime, visitDurationMinutes) {
  const duration = normalizeGuestVisitMinutes(visitDurationMinutes) ?? DEFAULT_GUEST_VISIT_MINUTES;
  const candidateStart = timeToMinutes(candidateTime);
  const candidateEnd = candidateStart + duration;
  let peak = 0;

  for (let cursor = candidateStart; cursor < candidateEnd; cursor += SLOT_INTERVAL_MINUTES) {
    let occupied = 0;
    for (const booking of bookings) {
      if (doesBookingOccupyMinute(booking, cursor)) {
        occupied += Number(booking.partySize ?? 0);
      }
    }
    peak = Math.max(peak, occupied);
  }

  return peak;
}

function doesBookingOccupyMinute(booking, minute) {
  const start = timeToMinutes(booking.bookingTime);
  const duration = normalizeGuestVisitMinutes(booking.visitDurationMinutes) ?? DEFAULT_GUEST_VISIT_MINUTES;
  const end = start + duration;
  return minute >= start && minute < end;
}

function getBookingsForDate(bookingsByDateTime, date) {
  const result = [];
  for (const [key, bookings] of bookingsByDateTime.entries()) {
    if (key.startsWith(`${date}|`)) {
      result.push(...bookings);
    }
  }
  return result;
}

function buildAvailabilityForDate({ date, seatCount, openingHours, closedDates, bookingsByDateTime, includeBookings }) {
  const weekdayIndex = dateToWeekdayIndex(date);
  const dayHours = openingHours.get(weekdayIndex) ?? {
    weekdayIndex,
    label: WEEKDAY_LABELS[weekdayIndex],
    isOpen: false,
    openTime: "",
    closeTime: "",
  };
  const isBlocked = closedDates.has(date);

  const slotTimes = dayHours.isOpen
    ? buildBookableStartTimes(dayHours.openTime, dayHours.closeTime, seatCount.guestVisitMinutes)
    : [];
  const dayBookings = getBookingsForDate(bookingsByDateTime, date);
  const slots = slotTimes.map((time) => {
    const bookings = bookingsByDateTime.get(`${date}|${time}`) ?? [];
    const booked = getPeakOccupiedSeatsForBookingWindow(dayBookings, time, seatCount.guestVisitMinutes);
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
  const totalCapacity = slots.reduce((sum, slot) => sum + slot.capacity, 0);
  const totalRemaining = slots.reduce((sum, slot) => sum + slot.remaining, 0);
  const availableSlotCount = slots.reduce((sum, slot) => sum + (slot.available ? 1 : 0), 0);

  return {
    date,
    isOpen: dayHours.isOpen,
    isBlocked,
    canBook: dayHours.isOpen && !isBlocked,
    openTime: dayHours.openTime,
    closeTime: dayHours.closeTime,
    capacity: dayHours.isOpen ? totalCapacity : 0,
    remaining: dayHours.isOpen ? totalRemaining : 0,
    minRemaining: dayHours.isOpen ? minRemaining : 0,
    maxRemaining: dayHours.isOpen ? maxRemaining : 0,
    slotCapacity: seatCount.seatCount,
    maxPartySize: seatCount.maxPartySize,
    guestVisitMinutes: seatCount.guestVisitMinutes,
    availableSlotCount: dayHours.isOpen ? availableSlotCount : 0,
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
       visit_duration_minutes,
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

export async function getSeatCountContext(seatCountId) {
  const result = await pool.query(
    `SELECT id, establishment_id, seat_count, guest_visit_minutes, max_party_size
     FROM establishment_seat_counts
     WHERE id = $1`,
    [seatCountId],
  );

  return result.rows[0]
      ? {
        id: result.rows[0].id,
        establishmentId: result.rows[0].establishment_id,
        seatCount: Number(result.rows[0].seat_count),
        maxPartySize: normalizeMaxPartySize(result.rows[0].max_party_size, result.rows[0].seat_count),
        guestVisitMinutes:
          normalizeGuestVisitMinutes(result.rows[0].guest_visit_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
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

async function listClosedDatesForSeatCountRange(seatCountId, startDate, endDate) {
  const result = await pool.query(
    `SELECT booking_date
     FROM seat_count_closed_dates
     WHERE seat_count_id = $1
       AND booking_date >= $2
       AND booking_date <= $3`,
    [seatCountId, startDate, endDate],
  );

  return new Set(result.rows.map((row) => row.booking_date));
}

async function isSeatCountDateClosed(seatCountId, bookingDate) {
  const result = await pool.query(
    `SELECT 1
     FROM seat_count_closed_dates
     WHERE seat_count_id = $1
       AND booking_date = $2
     LIMIT 1`,
    [seatCountId, bookingDate],
  );

  return Boolean(result.rows[0]);
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
  const firstName = decryptBookingField(row.customer_first_name_encrypted, { fallback: "Unreadable" });
  const lastName = decryptBookingField(row.customer_last_name_encrypted, { fallback: "record" });
  const email = decryptBookingField(row.customer_email_encrypted, { fallback: "unavailable" });
  const phone = decryptBookingField(row.customer_phone_encrypted, { fallback: "unavailable" });
  const notes = decryptBookingField(row.notes_encrypted, { fallback: "" });
  const unreadableFields = [
    !firstName.readable ? "firstName" : "",
    !lastName.readable ? "lastName" : "",
    !email.readable ? "email" : "",
    !phone.readable ? "phone" : "",
    !notes.readable ? "notes" : "",
  ].filter(Boolean);

  if (unreadableFields.length) {
    console.warn("Booking decrypt fallback used", {
      bookingId: row.id,
      unreadableFields,
    });
  }

  return {
    id: row.id,
    seatCountId: row.seat_count_id,
    establishmentId: row.establishment_id,
    seatCount: row.seat_count ? Number(row.seat_count) : null,
    establishmentName: row.establishment_name ?? "",
    companyName: row.company_name ?? "",
    bookingDate: row.booking_date,
    bookingTime: row.booking_time,
    partySize: Number(row.party_size ?? 1),
    visitDurationMinutes:
      normalizeGuestVisitMinutes(row.visit_duration_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
    firstName: firstName.value,
    lastName: lastName.value,
    email: email.value,
    phone: phone.value,
    notes: notes.value,
    unreadable: unreadableFields.length > 0,
    unreadableFields,
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
      seatCount: row.seat_count ? Number(row.seat_count) : null,
      establishmentName: row.establishment_name ?? "",
      companyName: row.company_name ?? "",
      bookingDate: row.booking_date,
      bookingTime: row.booking_time,
      partySize: Number(row.party_size ?? 1),
      visitDurationMinutes:
        normalizeGuestVisitMinutes(row.visit_duration_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
      firstName: "Unreadable",
      lastName: "booking",
      email: "current key cannot decrypt",
      phone: "current key cannot decrypt",
      notes: "This row was encrypted with a different key or has invalid stored data.",
      unreadable: true,
      unreadableFields: ["firstName", "lastName", "email", "phone", "notes"],
    };
  }
}

function decryptBookingField(value, options = {}) {
  const fallback = options.fallback ?? "Unavailable";

  try {
    return {
      value: decryptText(value),
      readable: true,
    };
  } catch {
    return {
      value: fallback,
      readable: false,
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
