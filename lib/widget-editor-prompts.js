import { pool } from "./db.js";
import { BOOKING_WIDGET_KEY, THEME_WIDGET_KEYS } from "./widget-themes.js";

const MAX_PROMPT_NAME_LENGTH = 120;
const MAX_PROMPT_TEXT_LENGTH = 12000;

export async function listWidgetEditorPrompts(widgetKey = BOOKING_WIDGET_KEY) {
  const normalizedWidgetKey = normalizeWidgetKey(widgetKey);
  const result = normalizedWidgetKey
    ? await pool.query(
        `SELECT id, widget_key, name, prompt_text, updated_at
         FROM widget_editor_prompts
         WHERE widget_key = $1
         ORDER BY updated_at DESC, name ASC`,
        [normalizedWidgetKey],
      )
    : await pool.query(
        `SELECT id, widget_key, name, prompt_text, updated_at
         FROM widget_editor_prompts
         ORDER BY updated_at DESC, name ASC`,
      );

  return result.rows.map(presentPrompt);
}

export function sanitizeWidgetEditorPromptInput(body) {
  const promptId = normalizeId(body.promptId);
  const widgetKey = normalizeWidgetKey(body.widgetKey);
  const name = String(body.name ?? "").trim();
  const promptText = String(body.promptText ?? "").trim();

  if (!name) {
    return { error: "Prompt name is required." };
  }

  if (name.length > MAX_PROMPT_NAME_LENGTH) {
    return { error: `Prompt name must be ${MAX_PROMPT_NAME_LENGTH} characters or fewer.` };
  }

  if (!promptText) {
    return { error: "Prompt text is required." };
  }

  if (promptText.length > MAX_PROMPT_TEXT_LENGTH) {
    return { error: `Prompt text must be ${MAX_PROMPT_TEXT_LENGTH} characters or fewer.` };
  }

  return {
    promptId,
    widgetKey,
    name,
    promptText,
  };
}

export function sanitizeWidgetEditorPromptDeleteInput(body) {
  const promptId = normalizeId(body.promptId);
  if (!promptId) {
    return { error: "A valid prompt is required." };
  }

  return {
    promptId,
    widgetKey: normalizeWidgetKey(body.widgetKey),
  };
}

export async function saveWidgetEditorPrompt(input) {
  if (input.promptId) {
    const result = await pool.query(
      `UPDATE widget_editor_prompts
       SET name = $1, prompt_text = $2, updated_at = now()
       WHERE id = $3 AND widget_key = $4
       RETURNING id, widget_key, name, prompt_text, updated_at`,
      [input.name, input.promptText, input.promptId, input.widgetKey],
    );

    return result.rows[0] ? presentPrompt(result.rows[0]) : null;
  }

  const result = await pool.query(
    `INSERT INTO widget_editor_prompts (widget_key, name, prompt_text, updated_at)
     VALUES ($1, $2, $3, now())
     RETURNING id, widget_key, name, prompt_text, updated_at`,
    [input.widgetKey, input.name, input.promptText],
  );

  return presentPrompt(result.rows[0]);
}

export async function deleteWidgetEditorPrompt(input) {
  const result = await pool.query(
    `DELETE FROM widget_editor_prompts
     WHERE id = $1 AND widget_key = $2
     RETURNING id`,
    [input.promptId, input.widgetKey],
  );

  return Boolean(result.rows[0]?.id);
}

function presentPrompt(row) {
  return {
    id: row.id,
    widgetKey: row.widget_key,
    name: row.name,
    promptText: row.prompt_text ?? "",
    updatedAt: row.updated_at ?? null,
  };
}

function normalizeWidgetKey(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return THEME_WIDGET_KEYS.has(trimmed) ? trimmed : BOOKING_WIDGET_KEY;
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
