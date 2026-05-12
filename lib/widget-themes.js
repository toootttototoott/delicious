import { pool } from "./db.js";

export const BOOKING_WIDGET_KEY = "booking_calendar";

export async function getWidgetTheme(establishmentId, widgetKey = BOOKING_WIDGET_KEY) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    return null;
  }

  const result = await pool.query(
    `SELECT establishment_id, widget_key, css_text, updated_at
     FROM establishment_widget_themes
     WHERE establishment_id = $1 AND widget_key = $2`,
    [normalizedEstablishmentId, widgetKey],
  );

  return presentTheme(result.rows[0], normalizedEstablishmentId, widgetKey);
}

export async function upsertWidgetTheme(establishmentId, cssText, widgetKey = BOOKING_WIDGET_KEY) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    throw new Error("Invalid establishment id.");
  }

  await pool.query(
    `UPSERT INTO establishment_widget_themes (
       establishment_id,
       widget_key,
       css_text,
       updated_at
     )
     VALUES ($1, $2, $3, now())`,
    [normalizedEstablishmentId, widgetKey, String(cssText ?? "")],
  );

  return getWidgetTheme(normalizedEstablishmentId, widgetKey);
}

export function sanitizeWidgetThemeInput(body) {
  const establishmentId = normalizeId(body.establishmentId);
  const cssText = String(body.cssText ?? "");
  const widgetKey = normalizeWidgetKey(body.widgetKey);

  if (!establishmentId) {
    return { error: "Establishment is required." };
  }

  if (!widgetKey) {
    return { error: "Widget type is invalid." };
  }

  if (cssText.length > 60000) {
    return { error: "Widget CSS is too large." };
  }

  return {
    establishmentId,
    widgetKey,
    cssText,
  };
}

export async function getWidgetEditorContext(establishmentId, widgetKey = BOOKING_WIDGET_KEY) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    return null;
  }

  const result = await pool.query(
    `SELECT
       e.id,
       e.name,
       c.id AS company_id,
       c.name AS company_name
     FROM establishments e
     JOIN companies c ON c.id = e.company_id
     WHERE e.id = $1`,
    [normalizedEstablishmentId],
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const theme = await getWidgetTheme(normalizedEstablishmentId, widgetKey);

  return {
    establishmentId: row.id,
    establishmentName: row.name,
    companyId: row.company_id,
    companyName: row.company_name,
    widgetKey,
    cssText: theme?.cssText ?? "",
    updatedAt: theme?.updatedAt ?? null,
  };
}

function presentTheme(row, establishmentId, widgetKey) {
  return {
    establishmentId,
    widgetKey,
    cssText: row?.css_text ?? "",
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeWidgetKey(value) {
  const trimmed = String(value ?? BOOKING_WIDGET_KEY).trim() || BOOKING_WIDGET_KEY;
  return trimmed === BOOKING_WIDGET_KEY ? trimmed : null;
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
