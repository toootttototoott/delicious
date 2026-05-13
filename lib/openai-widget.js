import { openAiApiKey } from "./config.js";

export async function generateWidgetCssSuggestion({
  model,
  companyName,
  establishmentName,
  widgetKey,
  currentCss,
  requestText,
  attachments,
  reasoningEffort,
}) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const requestPayload = {
    model,
    store: false,
    max_output_tokens: 2400,
    instructions: buildInstructions(widgetKey),
    input: [
      {
        role: "user",
        content: buildInputContent({
          companyName,
          establishmentName,
          currentCss,
          requestText,
          attachments,
        }),
      },
    ],
    text: {
      format: {
        type: "text",
      },
    },
  };

  if (reasoningEffort) {
    requestPayload.reasoning = {
      effort: reasoningEffort,
    };
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openAiApiKey}`,
    },
    body: JSON.stringify(requestPayload),
  });

  const responsePayload = await response.json();
  if (!response.ok) {
    throw new Error(responsePayload.error?.message ?? "OpenAI request failed.");
  }

  const cssText = normalizeCssOutput(extractOutputText(responsePayload));
  if (!cssText) {
    throw new Error("OpenAI returned an empty CSS response.");
  }

  return {
    cssText,
    responseId: responsePayload.id ?? null,
    usage: responsePayload.usage ?? null,
    model: responsePayload.model ?? model,
  };
}

export function sanitizeWidgetEditorRequest(body, options = {}) {
  const establishmentId = normalizeId(body.establishmentId);
  const model = normalizeModel(body.model);
  const widgetKey = normalizeWidgetKey(body.widgetKey);
  const requestText = String(body.requestText ?? "").trim();
  const currentCss = String(body.currentCss ?? "");
  const attachments = sanitizeAttachments(body.attachments ?? [], {
    maxTotalBytes: options.maxAttachmentBytes,
  });

  if (!establishmentId) {
    return { error: "Establishment is required." };
  }

  if (!model) {
    return { error: "A valid OpenAI model is required." };
  }

  if (!widgetKey) {
    return { error: "Widget type is invalid." };
  }

  if (!requestText) {
    return { error: "Describe the CSS change you want." };
  }

  if (requestText.length > 12000) {
    return { error: "The design request is too large." };
  }

  if (currentCss.length > 60000) {
    return { error: "The current CSS is too large." };
  }

  if (attachments.error) {
    return { error: attachments.error };
  }

  return {
    establishmentId,
    model,
    widgetKey,
    requestText,
    currentCss,
    attachments: attachments.attachments,
  };
}

function buildInstructions(widgetKey) {
  return [
    "You are editing CSS for an embedded booking widget.",
    `Target widget key: ${widgetKey}.`,
    "Return CSS only.",
    "Do not return markdown fences, prose, comments, JSON, or explanations.",
    "Scope all selectors under .widget-theme-root so the CSS only affects the booking widget.",
    "Do not style html, body, iframe, or any host-page selector outside .widget-theme-root.",
    "Prefer overriding the existing widget classes instead of inventing unrelated selectors.",
    "Calendar day state selectors include .calendar-date.status-open, .calendar-date.status-filling, .calendar-date.status-busy, .calendar-date.status-nearly-full, .calendar-date.status-full, .calendar-date.status-closed, and .calendar-date.status-unavailable.",
    "Time slot state selectors include .time-pill.status-open, .time-pill.status-filling, .time-pill.status-busy, .time-pill.status-nearly-full, and .time-pill.status-full.",
    "Calendar day cells and time slots expose --seat-load and --seat-load-raw custom properties that may be overridden per state.",
    "Available widget selectors include:",
    ".widget-theme-root, .widget-layout, .widget-calendar-panel, .calendar-nav, .calendar-month, .calendar-shell, .calendar-weekdays, .calendar-month-grid, .weekday, .calendar-cell, .calendar-date, .calendar-pad, .calendar-number, .calendar-caption, .time-pill, .widget-modal-backdrop, .widget-modal, .widget-form, .ghost-button, .status, .empty.",
    "Preserve usability, contrast, and mobile layout.",
  ].join("\n");
}

function buildInputContent({
  companyName,
  establishmentName,
  currentCss,
  requestText,
  attachments,
}) {
  const content = [
    {
      type: "input_text",
      text: [
        `Company: ${companyName}`,
        `Establishment: ${establishmentName}`,
        "",
        "Current widget CSS:",
        currentCss || "(none yet)",
        "",
        "Requested change:",
        requestText,
      ].join("\n"),
    },
  ];

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      content.push({
        type: "input_image",
        image_url: attachment.dataUrl,
      });
      content.push({
        type: "input_text",
        text: `Reference image attached: ${attachment.name}`,
      });
      continue;
    }

    content.push({
      type: "input_file",
      filename: attachment.name,
      file_data: attachment.dataUrl,
    });
  }

  return content;
}

function sanitizeAttachments(value, options = {}) {
  if (!Array.isArray(value)) {
    return { error: "Attachment payload is invalid." };
  }

  const attachments = [];
  const maxTotalBytes = normalizeAttachmentLimit(options?.maxTotalBytes);
  let totalBytes = 0;

  for (const item of value) {
    const name = String(item?.name ?? "").trim();
    const mimeType = String(item?.mimeType ?? "").trim();
    const dataUrl = String(item?.dataUrl ?? "").trim();
    const kind = item?.kind === "image" ? "image" : "file";

    if (!name || !dataUrl.startsWith("data:")) {
      return { error: "Attachment payload is invalid." };
    }

    totalBytes += approximateDataUrlBytes(dataUrl);
    if (totalBytes > maxTotalBytes) {
      return {
        error: `Attachments are too large for one request. Keep them under roughly ${formatMegabytes(maxTotalBytes)} MB total.`,
      };
    }

    attachments.push({
      name: name.slice(0, 180),
      mimeType: mimeType.slice(0, 120),
      dataUrl,
      kind,
    });
  }

  return { attachments };
}

function extractOutputText(payload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text;
  }

  return (payload.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

function normalizeCssOutput(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    return "";
  }

  const fenced = trimmed.match(/^```(?:css)?\s*([\s\S]*?)```$/i);
  return (fenced ? fenced[1] : trimmed).trim();
}

function normalizeModel(value) {
  const trimmed = String(value ?? "").trim();
  return /^[a-z0-9][a-z0-9.-]{1,127}$/i.test(trimmed) ? trimmed : null;
}

function approximateDataUrlBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl ?? "").split(",", 2);
  return Math.floor((base64.length * 3) / 4);
}

function normalizeAttachmentLimit(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 2_500_000;
}

function formatMegabytes(bytes) {
  return (bytes / 1_000_000).toFixed(1).replace(/\.0$/, "");
}

function normalizeWidgetKey(value) {
  const trimmed = String(value ?? "booking_calendar").trim();
  return trimmed === "booking_calendar" ? trimmed : null;
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
