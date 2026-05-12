import { pool } from "./db.js";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";

export const OPENAI_MODEL_OPTIONS = [
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.5",
];

export async function getAppSettings() {
  const result = await pool.query(
    `SELECT openai_model
     FROM app_settings
     WHERE id = 'primary'`,
  );

  return {
    openAiModel: normalizeModel(result.rows[0]?.openai_model),
  };
}

export function sanitizeAppSettingsInput(body) {
  const openAiModel = normalizeModel(body.openAiModel);
  if (!openAiModel) {
    return { error: "A valid OpenAI model is required." };
  }

  return { openAiModel };
}

export async function updateAppSettings(input) {
  await pool.query(
    `UPSERT INTO app_settings (id, openai_model, updated_at)
     VALUES ('primary', $1, now())`,
    [input.openAiModel],
  );

  return getAppSettings();
}

function normalizeModel(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return DEFAULT_OPENAI_MODEL;
  }

  return /^[a-z0-9][a-z0-9.-]{1,127}$/i.test(trimmed) ? trimmed : null;
}
