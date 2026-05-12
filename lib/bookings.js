import { pool } from "./db.js";
import { encryptText } from "./security.js";

export async function listWidgetCatalog() {
  const [companiesResult, establishmentsResult, seatCountsResult] = await Promise.all([
    pool.query("SELECT id, name FROM companies ORDER BY name ASC"),
    pool.query("SELECT id, company_id, name FROM establishments ORDER BY name ASC"),
    pool.query(
      "SELECT id, establishment_id, seat_count FROM establishment_seat_counts ORDER BY seat_count ASC",
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

  const establishmentsByCompany = new Map();
  for (const row of establishmentsResult.rows) {
    const existing = establishmentsByCompany.get(row.company_id) ?? [];
    existing.push({
      id: row.id,
      companyId: row.company_id,
      name: row.name,
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

export async function listSeatCountAvailability(seatCountId, fromDate, days = 14) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  if (!normalizedSeatCountId) {
    return { error: "Invalid seat count." };
  }

  const startDate = normalizeDate(fromDate);
  if (!startDate) {
    return { error: "Invalid date." };
  }

  const dateWindow = buildDateWindow(startDate, days);
  const result = await pool.query(
    `SELECT booking_date, booking_time
     FROM bookings
     WHERE seat_count_id = $1
       AND booking_date = ANY($2::STRING[])`,
    [normalizedSeatCountId, dateWindow],
  );

  const bookedByDate = new Map();
  for (const row of result.rows) {
    const existing = bookedByDate.get(row.booking_date) ?? new Set();
    existing.add(row.booking_time);
    bookedByDate.set(row.booking_date, existing);
  }

  return {
    seatCountId: normalizedSeatCountId,
    dates: dateWindow.map((date) => ({
      date,
      slots: TIME_SLOTS.map((time) => ({
        time,
        available: !(bookedByDate.get(date)?.has(time) ?? false),
      })),
    })),
  };
}

export function sanitizeBookingInput(body) {
  const seatCountId = normalizeId(body.seatCountId);
  const bookingDate = normalizeDate(body.bookingDate);
  const bookingTime = normalizeTime(body.bookingTime);
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!seatCountId || !bookingDate || !bookingTime) {
    return { error: "Seat count, date, and time are required." };
  }

  if (!firstName || !lastName || !email || !phone) {
    return { error: "First name, last name, email, and phone are required." };
  }

  return {
    seatCountId,
    bookingDate,
    bookingTime,
    firstName,
    lastName,
    email,
    phone,
    notes,
  };
}

export async function createBooking(input) {
  const seatCountResult = await pool.query(
    `SELECT establishment_id
     FROM establishment_seat_counts
     WHERE id = $1`,
    [input.seatCountId],
  );

  if (!seatCountResult.rows[0]) {
    return { error: "Selected seat count does not exist." };
  }

  try {
    await pool.query(
      `INSERT INTO bookings (
         seat_count_id,
         establishment_id,
         booking_date,
         booking_time,
         customer_first_name_encrypted,
         customer_last_name_encrypted,
         customer_email_encrypted,
         customer_phone_encrypted,
         notes_encrypted
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.seatCountId,
        seatCountResult.rows[0].establishment_id,
        input.bookingDate,
        input.bookingTime,
        encryptText(input.firstName),
        encryptText(input.lastName),
        encryptText(input.email),
        encryptText(input.phone),
        encryptText(input.notes),
      ],
    );
  } catch (error) {
    if (error.code === "23505") {
      return { error: "That time has just been booked. Choose another time." };
    }

    throw error;
  }

  return {
    ok: true,
    bookingDate: input.bookingDate,
    bookingTime: input.bookingTime,
  };
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
  return TIME_SLOTS.includes(trimmed) ? trimmed : null;
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TIME_SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];
