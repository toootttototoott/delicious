import {
  DEFAULT_MAX_PARTY_SIZE,
  buildTimeSlots,
  DEFAULT_GUEST_VISIT_MINUTES,
  normalizeMaxPartySize,
  normalizeGuestVisitMinutes,
  WEEKDAY_LABELS,
} from "./bookings.js";
import { pool } from "./db.js";
import { BOOKING_PAGE_VIEW_KEY, BOOKING_WIDGET_KEY } from "./widget-themes.js";

export async function listCompaniesTree() {
  const [companiesResult, establishmentsResult, seatCountsResult, openingHoursResult, widgetThemesResult] = await Promise.all([
    pool.query("SELECT id, name, enquiry_email FROM companies ORDER BY name ASC"),
    pool.query("SELECT id, company_id, name FROM establishments ORDER BY name ASC"),
    pool.query(
      `SELECT id, establishment_id, seat_count, guest_visit_minutes, max_party_size
       FROM establishment_seat_counts
       ORDER BY seat_count ASC`,
    ),
    pool.query(
      `SELECT establishment_id, weekday_index, is_open, open_time, close_time
       FROM establishment_opening_hours
       ORDER BY establishment_id ASC, weekday_index ASC`,
    ),
    pool.query(
      `SELECT establishment_id, widget_key, css_text, content_json, updated_at
       FROM establishment_widget_themes
       WHERE widget_key IN ($1, $2)
       ORDER BY establishment_id ASC, widget_key ASC`,
      [BOOKING_WIDGET_KEY, BOOKING_PAGE_VIEW_KEY],
    ),
  ]);

  const openingHoursByEstablishment = new Map();
  for (const row of openingHoursResult.rows) {
    const existing = openingHoursByEstablishment.get(row.establishment_id) ?? [];
    existing.push(presentOpeningHour(row));
    openingHoursByEstablishment.set(row.establishment_id, existing);
  }

  const seatCountsByEstablishment = new Map();
  for (const row of seatCountsResult.rows) {
    const existing = seatCountsByEstablishment.get(row.establishment_id) ?? [];
    existing.push({
      id: row.id,
      establishmentId: row.establishment_id,
      seatCount: Number(row.seat_count),
      maxPartySize: normalizeMaxPartySize(row.max_party_size, row.seat_count),
      guestVisitMinutes:
        normalizeGuestVisitMinutes(row.guest_visit_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
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
      openingHours: fillOpeningHours(openingHoursByEstablishment.get(row.id) ?? []),
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

export async function listCompaniesTreeForSession(session) {
  const companies = await listCompaniesTree();
  if (session?.authLevel === "admin") {
    return companies;
  }

  const establishmentId = String(session?.establishmentId ?? "").trim();
  if (!establishmentId) {
    return [];
  }

  return companies
    .map((company) => ({
      ...company,
      establishments: company.establishments.filter((establishment) => establishment.id === establishmentId),
    }))
    .filter((company) => company.establishments.length > 0);
}

export function sanitizeCompanyInput(body) {
  const name = String(body.name ?? "").trim();
  const enquiryEmail = normalizeEmail(body.enquiryEmail);
  if (!name) {
    return { error: "Company name is required." };
  }

  if (!enquiryEmail) {
    return { error: "Enquiry email is required." };
  }

  return { name, enquiryEmail };
}

export async function createCompany(input) {
  const result = await pool.query(
    `INSERT INTO companies (name, enquiry_email)
     VALUES ($1, $2)
     RETURNING id, name, enquiry_email`,
    [input.name, input.enquiryEmail],
  );

  return {
    id: result.rows[0].id,
    name: result.rows[0].name,
    enquiryEmail: result.rows[0].enquiry_email ?? "",
    establishments: [],
  };
}

export async function updateCompany(companyId, input) {
  const normalizedCompanyId = normalizeId(companyId);
  if (!normalizedCompanyId) {
    throw new Error("Invalid company id.");
  }

  const result = await pool.query(
    `UPDATE companies
     SET
       name = $1,
       enquiry_email = $2
     WHERE id = $3
     RETURNING id, name, enquiry_email`,
    [input.name, input.enquiryEmail, normalizedCompanyId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        name: result.rows[0].name,
        enquiryEmail: result.rows[0].enquiry_email ?? "",
      }
    : null;
}

export async function deleteCompany(companyId) {
  const ids = [normalizeId(companyId)].filter(Boolean);
  if (!ids.length) {
    return { error: "Invalid company id." };
  }

  await deleteCompaniesByIds(ids);
  return { ok: true };
}

export async function bulkDeleteCompanies(companyIds) {
  const ids = companyIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one company." };
  }

  await deleteCompaniesByIds(ids);
  return { ok: true };
}

export function sanitizeEstablishmentInput(body) {
  const companyId = normalizeId(body.companyId);
  const name = String(body.name ?? "").trim();

  if (!companyId) {
    return { error: "Company is required." };
  }

  if (!name) {
    return { error: "Establishment name is required." };
  }

  return { companyId, name };
}

export async function createEstablishment(input) {
  const result = await pool.query(
    `INSERT INTO establishments (company_id, name)
     VALUES ($1, $2)
     RETURNING id, company_id, name`,
    [input.companyId, input.name],
  );

  const establishment = {
    id: result.rows[0].id,
    companyId: result.rows[0].company_id,
    name: result.rows[0].name,
    widgetTheme: {
      widgetKey: BOOKING_WIDGET_KEY,
      cssText: "",
      contentText: "",
      updatedAt: null,
    },
    pageViewTheme: {
      widgetKey: BOOKING_PAGE_VIEW_KEY,
      cssText: "",
      contentText: "",
      updatedAt: null,
    },
    openingHours: fillOpeningHours([]),
    seatCounts: [],
  };

  await upsertOpeningHours(establishment.id, establishment.openingHours);
  await pool.query(
    `UPSERT INTO establishment_widget_themes (establishment_id, widget_key, css_text, content_json, updated_at)
     VALUES ($1, 'booking_calendar', '', '', now())`,
    [establishment.id],
  );
  await pool.query(
    `UPSERT INTO establishment_widget_themes (establishment_id, widget_key, css_text, content_json, updated_at)
     VALUES ($1, 'booking_page_view', '', '', now())`,
    [establishment.id],
  );

  return establishment;
}

export async function updateEstablishment(establishmentId, input) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    throw new Error("Invalid establishment id.");
  }

  const result = await pool.query(
    `UPDATE establishments
     SET name = $1
     WHERE id = $2
     RETURNING id, company_id, name`,
    [input.name, normalizedEstablishmentId],
  );

  return result.rows[0]
    ? {
        id: result.rows[0].id,
        companyId: result.rows[0].company_id,
        name: result.rows[0].name,
      }
    : null;
}

export async function deleteEstablishment(establishmentId) {
  return bulkDeleteEstablishments([establishmentId]);
}

export function sanitizeSeatCountInput(body) {
  const establishmentId = normalizeId(body.establishmentId);
  const seatCount = Number(body.seatCount);
  const rawMaxPartySize = body.maxPartySize ?? seatCount ?? DEFAULT_MAX_PARTY_SIZE;
  const guestVisitMinutes =
    normalizeGuestVisitMinutes(body.guestVisitMinutes) ?? DEFAULT_GUEST_VISIT_MINUTES;

  if (!establishmentId) {
    return { error: "Establishment is required." };
  }

  if (!Number.isInteger(seatCount) || seatCount <= 0) {
    return { error: "Max capacity must be a positive whole number." };
  }

  const maxPartySize = normalizeMaxPartySize(rawMaxPartySize, seatCount);
  if (!Number.isInteger(Number(rawMaxPartySize)) || Number(rawMaxPartySize) <= 0) {
    return { error: "Max online booking party size must be a positive whole number." };
  }

  if (Number(rawMaxPartySize) > seatCount) {
    return { error: "Max online booking party size cannot be greater than max capacity." };
  }

  if (!normalizeGuestVisitMinutes(body.guestVisitMinutes ?? guestVisitMinutes)) {
    return { error: "Guest visit time must be in 15-minute increments." };
  }

  return { establishmentId, seatCount, maxPartySize, guestVisitMinutes };
}

export async function createSeatCount(input) {
  const result = await pool.query(
    `INSERT INTO establishment_seat_counts (establishment_id, seat_count, guest_visit_minutes, max_party_size)
     VALUES ($1, $2, $3, $4)
     RETURNING id, establishment_id, seat_count, guest_visit_minutes, max_party_size`,
    [input.establishmentId, input.seatCount, input.guestVisitMinutes, input.maxPartySize],
  );

  return {
    id: result.rows[0].id,
    establishmentId: result.rows[0].establishment_id,
    seatCount: Number(result.rows[0].seat_count),
    maxPartySize: normalizeMaxPartySize(result.rows[0].max_party_size, result.rows[0].seat_count),
    guestVisitMinutes:
      normalizeGuestVisitMinutes(result.rows[0].guest_visit_minutes) ?? DEFAULT_GUEST_VISIT_MINUTES,
  };
}

export async function updateSeatCount(seatCountId, input) {
  const normalizedSeatCountId = normalizeId(seatCountId);
  if (!normalizedSeatCountId) {
    throw new Error("Invalid seat count id.");
  }

  const result = await pool.query(
    `UPDATE establishment_seat_counts
     SET
       seat_count = $1,
       guest_visit_minutes = $2,
       max_party_size = $3
     WHERE id = $4
     RETURNING id, establishment_id, seat_count, guest_visit_minutes, max_party_size`,
    [input.seatCount, input.guestVisitMinutes, input.maxPartySize, normalizedSeatCountId],
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

export async function deleteSeatCount(seatCountId) {
  return bulkDeleteSeatCounts([seatCountId]);
}

export function sanitizeOpeningHoursInput(body) {
  let openingHours = body.openingHours;

  if (typeof openingHours === "string") {
    try {
      openingHours = JSON.parse(openingHours);
    } catch {
      return { error: "Opening hours payload is invalid." };
    }
  }

  if (!Array.isArray(openingHours)) {
    return { error: "Opening hours payload is invalid." };
  }

  const normalized = [];
  for (const weekdayIndex of WEEKDAY_LABELS.map((_, index) => index)) {
    const item = openingHours.find((entry) => Number(entry.weekdayIndex) === weekdayIndex) ?? {};
    const isOpen = item.isOpen === true || item.isOpen === "true" || item.isOpen === "on";
    const openTime = normalizeTime(item.openTime);
    const closeTime = normalizeTime(item.closeTime);

    if (isOpen) {
      if (!openTime || !closeTime) {
        return { error: `Open and close times are required for ${WEEKDAY_LABELS[weekdayIndex]}.` };
      }

      if (!buildTimeSlots(openTime, closeTime).length) {
        return { error: `${WEEKDAY_LABELS[weekdayIndex]} must have a close time after its open time.` };
      }
    }

    normalized.push({
      weekdayIndex,
      label: WEEKDAY_LABELS[weekdayIndex],
      isOpen,
      openTime: isOpen ? openTime : "",
      closeTime: isOpen ? closeTime : "",
    });
  }

  return { openingHours: normalized };
}

export async function updateOpeningHours(establishmentId, openingHours) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    throw new Error("Invalid establishment id.");
  }

  await upsertOpeningHours(normalizedEstablishmentId, fillOpeningHours(openingHours));
  return { ok: true };
}

export async function bulkDeleteEstablishments(establishmentIds) {
  const ids = establishmentIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one establishment." };
  }

  const seatCountIdsResult = await pool.query(
    "SELECT id FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])",
    [ids],
  );
  const seatCountIds = seatCountIdsResult.rows.map((row) => row.id);

  if (seatCountIds.length) {
    await pool.query("DELETE FROM bookings WHERE seat_count_id = ANY($1::UUID[])", [seatCountIds]);
  }

  await pool.query("DELETE FROM establishment_opening_hours WHERE establishment_id = ANY($1::UUID[])", [
    ids,
  ]);
  await pool.query("DELETE FROM establishment_widget_themes WHERE establishment_id = ANY($1::UUID[])", [
    ids,
  ]);
  await pool.query("DELETE FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])", [
    ids,
  ]);
  await pool.query("UPDATE app_users SET establishment_id = NULL WHERE establishment_id = ANY($1::UUID[])", [
    ids,
  ]);
  await pool.query("DELETE FROM establishments WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

export async function bulkDeleteSeatCounts(seatCountIds) {
  const ids = seatCountIds.map(normalizeId).filter(Boolean);
  if (!ids.length) {
    return { error: "Select at least one seat count." };
  }

  await pool.query("DELETE FROM bookings WHERE seat_count_id = ANY($1::UUID[])", [ids]);
  await pool.query("DELETE FROM establishment_seat_counts WHERE id = ANY($1::UUID[])", [ids]);
  return { ok: true };
}

async function deleteCompaniesByIds(companyIds) {
  const establishmentIdsResult = await pool.query(
    "SELECT id FROM establishments WHERE company_id = ANY($1::UUID[])",
    [companyIds],
  );
  const establishmentIds = establishmentIdsResult.rows.map((row) => row.id);

  await pool.query("UPDATE app_users SET company_id = NULL WHERE company_id = ANY($1::UUID[])", [
    companyIds,
  ]);

  if (establishmentIds.length) {
    const seatCountIdsResult = await pool.query(
      "SELECT id FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])",
      [establishmentIds],
    );
    const seatCountIds = seatCountIdsResult.rows.map((row) => row.id);

    await pool.query("UPDATE app_users SET establishment_id = NULL WHERE establishment_id = ANY($1::UUID[])", [
      establishmentIds,
    ]);
    await pool.query("DELETE FROM establishment_opening_hours WHERE establishment_id = ANY($1::UUID[])", [
      establishmentIds,
    ]);
    await pool.query("DELETE FROM establishment_widget_themes WHERE establishment_id = ANY($1::UUID[])", [
      establishmentIds,
    ]);

    if (seatCountIds.length) {
      await pool.query("DELETE FROM bookings WHERE seat_count_id = ANY($1::UUID[])", [seatCountIds]);
    }

    await pool.query(
      "DELETE FROM establishment_seat_counts WHERE establishment_id = ANY($1::UUID[])",
      [establishmentIds],
    );
  }

  await pool.query("DELETE FROM establishments WHERE company_id = ANY($1::UUID[])", [companyIds]);
  await pool.query("DELETE FROM companies WHERE id = ANY($1::UUID[])", [companyIds]);
}

async function upsertOpeningHours(establishmentId, openingHours) {
  const rows = fillOpeningHours(openingHours);
  for (const row of rows) {
    await pool.query(
      `UPSERT INTO establishment_opening_hours (
         establishment_id,
         weekday_index,
         is_open,
         open_time,
         close_time,
         updated_at
       )
       VALUES ($1, $2, $3, $4, $5, now())`,
      [
        establishmentId,
        row.weekdayIndex,
        row.isOpen,
        row.isOpen ? row.openTime : null,
        row.isOpen ? row.closeTime : null,
      ],
    );
  }
}

function fillOpeningHours(openingHours) {
  const byDay = new Map((openingHours ?? []).map((item) => [Number(item.weekdayIndex), item]));
  return WEEKDAY_LABELS.map((label, weekdayIndex) => {
    const value = byDay.get(weekdayIndex);
    return {
      weekdayIndex,
      label,
      isOpen: Boolean(value?.isOpen),
      openTime: value?.isOpen ? String(value.openTime ?? "") : "",
      closeTime: value?.isOpen ? String(value.closeTime ?? "") : "",
    };
  });
}

function presentOpeningHour(row) {
  return {
    weekdayIndex: Number(row.weekday_index),
    label: WEEKDAY_LABELS[Number(row.weekday_index)] ?? "",
    isOpen: Boolean(row.is_open),
    openTime: row.open_time ?? "",
    closeTime: row.close_time ?? "",
  };
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

function normalizeTime(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeEmail(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
