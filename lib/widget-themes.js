import { pool } from "./db.js";

export const BOOKING_WIDGET_KEY = "booking_calendar";
export const BOOKING_PAGE_VIEW_KEY = "booking_page_view";
export const THEME_WIDGET_KEYS = new Set([BOOKING_WIDGET_KEY, BOOKING_PAGE_VIEW_KEY]);

export async function getWidgetTheme(establishmentId, widgetKey = BOOKING_WIDGET_KEY) {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    return null;
  }

  const result = await pool.query(
    `SELECT establishment_id, widget_key, css_text, content_json, updated_at
     FROM establishment_widget_themes
     WHERE establishment_id = $1 AND widget_key = $2`,
    [normalizedEstablishmentId, widgetKey],
  );

  return presentTheme(result.rows[0], normalizedEstablishmentId, widgetKey);
}

export async function upsertWidgetTheme(establishmentId, cssText, widgetKey = BOOKING_WIDGET_KEY, contentText = "") {
  const normalizedEstablishmentId = normalizeId(establishmentId);
  if (!normalizedEstablishmentId) {
    throw new Error("Invalid establishment id.");
  }

  await pool.query(
    `UPSERT INTO establishment_widget_themes (
       establishment_id,
       widget_key,
       css_text,
       content_json,
       updated_at
     )
     VALUES ($1, $2, $3, $4, now())`,
    [normalizedEstablishmentId, widgetKey, String(cssText ?? ""), String(contentText ?? "")],
  );

  return getWidgetTheme(normalizedEstablishmentId, widgetKey);
}

export function sanitizeWidgetThemeInput(body) {
  const establishmentId = normalizeId(body.establishmentId);
  const cssText = String(body.cssText ?? "");
  const contentText = String(body.contentText ?? "");
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

  if (contentText.length > 120000) {
    return { error: "Page content is too large." };
  }

  const cssValidation = validateWidgetCssText(cssText, widgetKey);
  if (cssValidation.error) {
    return cssValidation;
  }

  return {
    establishmentId,
    widgetKey,
    cssText,
    contentText,
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
    contentText: theme?.contentText ?? "",
    updatedAt: theme?.updatedAt ?? null,
  };
}

function presentTheme(row, establishmentId, widgetKey) {
  return {
    establishmentId,
    widgetKey,
    cssText: row?.css_text ?? "",
    contentText: row?.content_json ?? "",
    updatedAt: row?.updated_at ?? null,
  };
}

function normalizeWidgetKey(value) {
  const trimmed = String(value ?? BOOKING_WIDGET_KEY).trim() || BOOKING_WIDGET_KEY;
  return THEME_WIDGET_KEYS.has(trimmed) ? trimmed : null;
}

function validateWidgetCssText(cssText, widgetKey) {
  const trimmed = String(cssText ?? "").trim();
  if (!trimmed) {
    return { ok: true };
  }

  if (/@import\b/i.test(trimmed)) {
    return { error: "Widget CSS cannot use @import." };
  }

  if (/url\s*\(\s*(['"]?)(https?:|\/\/)/i.test(trimmed)) {
    return { error: "Widget CSS cannot load remote assets with url()." };
  }

  const requiredRootClass = widgetKey === BOOKING_PAGE_VIEW_KEY ? ".page-view-theme-root" : ".widget-theme-root";
  if (!trimmed.includes(requiredRootClass)) {
    return { error: `Widget CSS must stay scoped under ${requiredRootClass}.` };
  }

  return { ok: true };
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
