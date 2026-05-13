import { pool } from "./db.js";

export const DEFAULT_OPENAI_MODEL = "gpt-5.4-nano";
export const DEFAULT_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES = 2_500_000;
export const MAX_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES = 3_000_000;
export const MIN_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES = 500_000;
export const OPENAI_REASONING_EFFORT_OPTIONS = [
  "",
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
];

export const OPENAI_MODEL_OPTIONS = [
  "gpt-5.4-nano",
  "gpt-5.4-mini",
  "gpt-5.4",
  "gpt-5.5",
];

export async function getAppSettings() {
  const result = await pool.query(
    `SELECT openai_model, openai_reasoning_effort, widget_editor_upload_limit_bytes
     FROM app_settings
     WHERE id = 'primary'`,
  );

  return {
    openAiModel: normalizeModel(result.rows[0]?.openai_model),
    openAiReasoningEffort: normalizeStoredReasoningEffort(result.rows[0]?.openai_reasoning_effort),
    widgetEditorUploadLimitBytes: normalizeStoredUploadLimitBytes(
      result.rows[0]?.widget_editor_upload_limit_bytes,
    ),
  };
}

export function sanitizeAppSettingsInput(body) {
  const openAiModel = normalizeModel(body.openAiModel);
  const openAiReasoningEffort = normalizeReasoningEffort(body.openAiReasoningEffort);
  const widgetEditorUploadLimitBytes = normalizeWidgetEditorUploadLimitBytes(
    body.widgetEditorUploadLimitMb,
  );

  if (!openAiModel) {
    return { error: "A valid OpenAI model is required." };
  }

  if (openAiReasoningEffort === null) {
    return { error: "The reasoning effort setting is invalid." };
  }

  if (widgetEditorUploadLimitBytes === null) {
    return {
      error: `The upload limit must be between ${formatMegabytes(MIN_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES)} MB and ${formatMegabytes(MAX_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES)} MB.`,
    };
  }

  return { openAiModel, openAiReasoningEffort, widgetEditorUploadLimitBytes };
}

export async function updateAppSettings(input) {
  await pool.query(
    `UPSERT INTO app_settings (
       id,
       openai_model,
       openai_reasoning_effort,
       widget_editor_upload_limit_bytes,
       updated_at
     )
     VALUES ('primary', $1, $2, $3, now())`,
    [
      input.openAiModel,
      input.openAiReasoningEffort || null,
      input.widgetEditorUploadLimitBytes,
    ],
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

function normalizeReasoningEffort(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return OPENAI_REASONING_EFFORT_OPTIONS.includes(trimmed) ? trimmed : null;
}

function normalizeStoredReasoningEffort(value) {
  const normalized = normalizeReasoningEffort(value);
  return normalized === null ? "" : normalized;
}

function normalizeStoredUploadLimitBytes(value) {
  const normalized = normalizeWidgetEditorUploadLimitBytes(
    Number(value ?? DEFAULT_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES) / 1_000_000,
  );
  return normalized ?? DEFAULT_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES;
}

function normalizeWidgetEditorUploadLimitBytes(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const bytes = Math.round(numeric * 1_000_000);
  if (
    bytes < MIN_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES ||
    bytes > MAX_WIDGET_EDITOR_UPLOAD_LIMIT_BYTES
  ) {
    return null;
  }

  return bytes;
}

function formatMegabytes(bytes) {
  return (bytes / 1_000_000).toFixed(1).replace(/\.0$/, "");
}
