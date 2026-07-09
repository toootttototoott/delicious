import { openAiApiKey } from "./config.js";

export async function generateWidgetCssSuggestion({
  model,
  companyName,
  establishmentName,
  widgetKey,
  currentCss,
  currentContentText,
  requestText,
  attachments,
  preserveExistingCss,
  reasoningEffort,
  maxOutputTokens,
}) {
  if (!openAiApiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const requestPayload = {
    model,
    store: false,
    max_output_tokens: normalizeMaxOutputTokens(maxOutputTokens),
    instructions: buildInstructions(widgetKey, { preserveExistingCss }),
    input: [
      {
        role: "user",
        content: buildInputContent({
          companyName,
          establishmentName,
          widgetKey,
          currentCss,
          currentContentText,
          requestText,
          attachments,
          preserveExistingCss,
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

  if (responsePayload.status === "incomplete") {
    const reason = responsePayload.incomplete_details?.reason;
    if (reason === "max_output_tokens") {
      throw new Error(
        "The model ran out of tokens before producing CSS. Increase the max output token setting or lower reasoning effort.",
      );
    }

    throw new Error(`OpenAI returned an incomplete response${reason ? `: ${reason}.` : "."}`);
  }

  const rawOutputText = extractOutputText(responsePayload);
  const generated =
    widgetKey === "booking_page_view"
      ? normalizePageViewSuggestionOutput(rawOutputText)
      : { cssText: normalizeCssOutput(rawOutputText), contentText: "" };

  if (!generated.cssText) {
    throw new Error("OpenAI returned an empty CSS response.");
  }

  const finalCssText =
    preserveExistingCss && currentCss.trim()
      ? mergeSavedBaselineCss(currentCss, generated.cssText)
      : generated.cssText;

  return {
    cssText: finalCssText,
    contentText: generated.contentText ?? "",
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
  const currentContentText = String(body.currentContentText ?? "");
  const reasoningEffort = normalizeReasoningEffort(body.reasoningEffort);
  const useSavedCssBaseline = normalizeBoolean(body.useSavedCssBaseline, true);
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

  if (currentContentText.length > 120000) {
    return { error: "The current page content is too large." };
  }

  if (reasoningEffort === null) {
    return { error: "Reasoning effort is invalid." };
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
    currentContentText,
    reasoningEffort,
    useSavedCssBaseline,
    attachments: attachments.attachments,
  };
}

function buildInstructions(widgetKey, options = {}) {
  const preserveExistingCss = options?.preserveExistingCss === true;
  if (widgetKey === "booking_page_view") {
    const instructions = [
      "You are building a standalone booking page from a near-blank slate.",
      `Target widget key: ${widgetKey}.`,
      "Return a JSON object only.",
      "Do not return markdown fences, prose, comments, or explanations.",
      'The JSON object must have exactly these top-level keys: "pageContent" and "cssText".',
      '"cssText" must be a string containing CSS only.',
      '"pageContent" must be an object with optional string keys such as kicker, title, intro and a required "sections" array.',
      'Each section object must include a "type" and may use these shapes: hero, text, split, highlights, image, quote, calendar.',
      'A calendar section must always be present somewhere in the sections array.',
      "Treat the page structure, copy, hierarchy, and styling as prompt-driven.",
      "Do not assume a centered layout, section order, card treatment, spacing rhythm, or visual emphasis unless the prompt asks for it.",
      "Use the prompt and references to decide whether the calendar should be the hero, the main focal section, or a supporting section.",
      "If the prompt provides copy direction or actual copy, reflect it in pageContent rather than leaving generic filler.",
      "Use pageContent to define the actual page composition and cssText to style that composition.",
      "Scope all selectors under .page-view-theme-root so the CSS only affects the booking page.",
      "Do not style html or body directly. Keep all page-specific styling within .page-view-theme-root.",
      "Prefer overriding the existing booking page classes instead of inventing unrelated selectors.",
      "Available page selectors include:",
      ".page-view-theme-root, .page-view-layout, .page-view-panel, .page-view-header, .page-view-kicker, .page-view-title, .page-view-copy, .page-view-sections, .page-view-section, .page-view-section-hero, .page-view-section-text, .page-view-section-split, .page-view-section-highlights, .page-view-section-image, .page-view-section-quote, .page-view-section-calendar, .page-view-section-copy, .page-view-section-media, .page-view-highlight-grid, .page-view-highlight-card, .page-view-image, .page-view-quote, .widget-layout, .widget-calendar-panel, .calendar-nav, .calendar-month, .calendar-shell, .calendar-weekdays, .calendar-month-grid, .weekday, .calendar-cell, .calendar-date, .calendar-pad, .calendar-number, .calendar-caption, .time-pill, .widget-modal-backdrop, .widget-modal, .widget-form, .ghost-button, .status, .empty.",
      "Each seat-count calendar number is the maximum seats allowed in one 15-minute time slot.",
      "Calendar day fill states and --seat-load values represent aggregate occupancy across the whole day, combining all 15-minute slots for that day.",
      "Time slot fill states and --seat-load values represent occupancy within that individual 15-minute slot only.",
      "Calendar day state selectors include .calendar-date.status-open, .calendar-date.status-filling, .calendar-date.status-busy, .calendar-date.status-nearly-full, .calendar-date.status-full, .calendar-date.status-closed, and .calendar-date.status-unavailable.",
      "Time slot state selectors include .time-pill.status-open, .time-pill.status-filling, .time-pill.status-busy, .time-pill.status-nearly-full, and .time-pill.status-full.",
      "Calendar day cells and time slots expose --seat-load and --seat-load-raw custom properties that may be overridden per state.",
      "Preserve usability, contrast, and mobile layout.",
    ];
    if (preserveExistingCss) {
      instructions.push(
        "Treat the provided current CSS and current page content as the starting point only, not as a restriction.",
        "Follow the user's newest request over the saved baseline whenever they conflict.",
        "You may fully restructure the page when requested.",
        "It is valid to reorder sections, move the calendar, move supporting sections, change section types, add sections, remove sections, simplify sections, swap image usage, rewrite copy, or redesign the hierarchy when the request asks for that.",
        "If the request implies a broader redesign or rebuild, do the broader redesign instead of preserving the old structure out of inertia.",
        "Do not keep old content, old section ordering, or old styling just because it already exists.",
        "Only preserve parts of the saved page that still support the new request.",
        'Return the full updated JSON object, and make sure "cssText" contains the full updated stylesheet, not a diff.',
      );
    }
    return instructions.join("\n");
  }

  const instructions = [
    "You are editing CSS for an embedded booking widget.",
    `Target widget key: ${widgetKey}.`,
    "Return CSS only.",
    "Do not return markdown fences, prose, comments, JSON, or explanations.",
    "Scope all selectors under .widget-theme-root so the CSS only affects the booking widget.",
    "Do not style html, body, iframe, or any host-page selector outside .widget-theme-root.",
    "Prefer overriding the existing widget classes instead of inventing unrelated selectors.",
    "Each seat-count calendar number is the maximum seats allowed in one 15-minute time slot.",
    "Calendar day fill states and --seat-load values represent aggregate occupancy across the whole day, combining all 15-minute slots for that day.",
    "Time slot fill states and --seat-load values represent occupancy within that individual 15-minute slot only.",
    "Calendar day state selectors include .calendar-date.status-open, .calendar-date.status-filling, .calendar-date.status-busy, .calendar-date.status-nearly-full, .calendar-date.status-full, .calendar-date.status-closed, and .calendar-date.status-unavailable.",
    "Time slot state selectors include .time-pill.status-open, .time-pill.status-filling, .time-pill.status-busy, .time-pill.status-nearly-full, and .time-pill.status-full.",
    "Calendar day cells and time slots expose --seat-load and --seat-load-raw custom properties that may be overridden per state.",
    "Available widget selectors include:",
    ".widget-theme-root, .widget-layout, .widget-calendar-panel, .calendar-nav, .calendar-month, .calendar-shell, .calendar-weekdays, .calendar-month-grid, .weekday, .calendar-cell, .calendar-date, .calendar-pad, .calendar-number, .calendar-caption, .time-pill, .widget-modal-backdrop, .widget-modal, .widget-form, .ghost-button, .status, .empty.",
    "Preserve usability, contrast, and mobile layout.",
  ];
  if (preserveExistingCss) {
    instructions.push(
      "Treat the provided current CSS as the locked baseline.",
      "Make the smallest possible set of changes needed to satisfy the request.",
      "Keep all unrelated selectors, declarations, and values unchanged unless the request explicitly requires otherwise.",
      "Return the full updated CSS, not a diff.",
      "If you only need to change one selector, still return the full stylesheet with that selector updated.",
    );
  }
  return instructions.join("\n");
}

function buildInputContent({
  companyName,
  establishmentName,
  widgetKey,
  currentCss,
  currentContentText,
  requestText,
  attachments,
  preserveExistingCss,
}) {
  const cssLabel = widgetKey === "booking_page_view" ? "Current booking page CSS:" : "Current booking widget CSS:";
  const contentLabel = widgetKey === "booking_page_view" ? "Current booking page content JSON:" : "";
  const content = [
    {
      type: "input_text",
      text: [
        `Company: ${companyName}`,
        `Establishment: ${establishmentName}`,
        `Generation mode: ${preserveExistingCss ? "Preserve the latest saved CSS and change only what the request requires." : "Use the current draft CSS as the working baseline."}`,
        "Availability semantics:",
        "The seat-count value is the booking limit for one 15-minute slot.",
        "Calendar day status colours and --seat-load reflect aggregate occupancy across the whole day.",
        "Time slot status colours and --seat-load reflect occupancy for that specific 15-minute slot only.",
        ...(widgetKey === "booking_page_view"
          ? [
              "",
              contentLabel,
              currentContentText || "(none yet)",
            ]
          : []),
        "",
        cssLabel,
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
    const mimeType = normalizeAttachmentMimeType(item?.mimeType, item?.dataUrl);
    const dataUrl = String(item?.dataUrl ?? "").trim();
    const kind = item?.kind === "image" ? "image" : "file";

    if (!name || !dataUrl.startsWith("data:")) {
      return { error: "Attachment payload is invalid." };
    }

    if (!mimeType) {
      return { error: "Attachment type is invalid." };
    }

    if (kind === "image" && !ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
      return { error: "Only PNG, JPEG, WEBP, and GIF images are allowed." };
    }

    if (kind === "file" && !ALLOWED_FILE_MIME_TYPES.has(mimeType)) {
      return { error: "Only PDF and plain-text reference files are allowed." };
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

function normalizePageViewSuggestionOutput(text) {
  const parsed = parseJsonObject(text);
  const cssText = normalizeCssOutput(parsed?.cssText ?? "");
  const pageContent = normalizePageContent(parsed?.pageContent);
  if (!cssText) {
    throw new Error("OpenAI returned an empty booking page CSS response.");
  }
  return {
    cssText,
    contentText: JSON.stringify(pageContent, null, 2),
  };
}

function parseJsonObject(text) {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) {
    throw new Error("OpenAI returned an empty booking page response.");
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  const candidate = (fenced ? fenced[1] : trimmed).trim();

  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error("OpenAI returned invalid booking page JSON.");
  }
}

function normalizePageContent(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const sections = Array.isArray(input.sections)
    ? input.sections.map(normalizePageSection).filter(Boolean).slice(0, 12)
    : [];

  if (!sections.some((section) => section.type === "calendar")) {
    sections.push({
      type: "calendar",
      eyebrow: "Reservations",
      title: "Choose your time",
      copy: "Select a date and time to continue with your booking.",
    });
  }

  return {
    kicker: normalizeShortText(input.kicker, 120),
    title: normalizeShortText(input.title, 180) || "Book a table",
    intro: normalizeLongText(input.intro, 900),
    sections,
  };
}

function normalizePageSection(value) {
  const input = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const type = normalizePageSectionType(input.type);
  if (!type) {
    return null;
  }

  if (type === "hero" || type === "text" || type === "calendar") {
    return {
      type,
      eyebrow: normalizeShortText(input.eyebrow, 120),
      title: normalizeShortText(input.title, 180),
      copy: normalizeLongText(input.copy, 1200),
      align: normalizeEnum(input.align, ["left", "center"], "left"),
      imageUrl: type === "hero" ? normalizeUrl(input.imageUrl) : "",
      imageAlt: type === "hero" ? normalizeShortText(input.imageAlt, 180) : "",
    };
  }

  if (type === "split") {
    return {
      type,
      eyebrow: normalizeShortText(input.eyebrow, 120),
      title: normalizeShortText(input.title, 180),
      copy: normalizeLongText(input.copy, 1200),
      imageUrl: normalizeUrl(input.imageUrl),
      imageAlt: normalizeShortText(input.imageAlt, 180),
      imagePosition: normalizeEnum(input.imagePosition, ["left", "right"], "right"),
    };
  }

  if (type === "highlights") {
    const items = Array.isArray(input.items)
      ? input.items
          .map((item) => ({
            title: normalizeShortText(item?.title, 120),
            copy: normalizeLongText(item?.copy, 320),
          }))
          .filter((item) => item.title || item.copy)
          .slice(0, 6)
      : [];
    return {
      type,
      eyebrow: normalizeShortText(input.eyebrow, 120),
      title: normalizeShortText(input.title, 180),
      items,
    };
  }

  if (type === "image") {
    return {
      type,
      imageUrl: normalizeUrl(input.imageUrl),
      imageAlt: normalizeShortText(input.imageAlt, 180),
      caption: normalizeLongText(input.caption, 320),
    };
  }

  return {
    type,
    quote: normalizeLongText(input.quote, 500),
    attribution: normalizeShortText(input.attribution, 180),
  };
}

function normalizePageSectionType(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return ["hero", "text", "split", "highlights", "image", "quote", "calendar"].includes(trimmed)
    ? trimmed
    : null;
}

function normalizeShortText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeLongText(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function normalizeUrl(value) {
  const trimmed = String(value ?? "").trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed.slice(0, 2000) : "";
}

function normalizeEnum(value, options, fallback) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return options.includes(trimmed) ? trimmed : fallback;
}

function mergeSavedBaselineCss(baselineCss, generatedCss) {
  const baseline = String(baselineCss ?? "").trim();
  const generated = String(generatedCss ?? "").trim();
  if (!baseline || !generated) {
    return generated;
  }

  if (isLikelyFullStylesheet(generated, baseline)) {
    return generated;
  }

  const baselineBlocks = extractTopLevelCssBlocks(baseline);
  const generatedBlocks = extractTopLevelCssBlocks(generated);
  if (!baselineBlocks.length || !generatedBlocks.length) {
    return generated;
  }

  const baselineBySelector = new Map();
  for (const block of baselineBlocks) {
    baselineBySelector.set(normalizeCssSelector(block.selector), block);
  }

  let merged = baseline;
  const replacements = [];
  const appendBlocks = [];

  for (const block of generatedBlocks) {
    const existing = baselineBySelector.get(normalizeCssSelector(block.selector));
    if (existing) {
      replacements.push({
        start: existing.start,
        end: existing.end,
        text: block.text.trim(),
      });
    } else {
      appendBlocks.push(block.text.trim());
    }
  }

  for (const replacement of replacements.sort((left, right) => right.start - left.start)) {
    merged = `${merged.slice(0, replacement.start)}${replacement.text}${merged.slice(replacement.end)}`;
  }

  if (appendBlocks.length) {
    merged = `${merged.trim()}\n\n${appendBlocks.join("\n\n")}`.trim();
  }

  return merged;
}

function isLikelyFullStylesheet(candidateCss, baselineCss) {
  const candidate = String(candidateCss ?? "").trim();
  const baseline = String(baselineCss ?? "").trim();
  if (!candidate) {
    return false;
  }

  if (!baseline) {
    return true;
  }

  const candidateBlocks = extractTopLevelCssBlocks(candidate);
  const baselineBlocks = extractTopLevelCssBlocks(baseline);

  if (!candidateBlocks.length) {
    return false;
  }

  if (candidate.length >= Math.max(600, baseline.length * 0.6)) {
    return true;
  }

  if (candidateBlocks.length >= Math.max(4, Math.floor(baselineBlocks.length * 0.5))) {
    return true;
  }

  return (
    candidateBlocks.length >= 3 &&
    candidate.length >= 250 &&
    candidateBlocks.some((block) =>
      [".widget-theme-root", ".page-view-theme-root"].includes(normalizeCssSelector(block.selector)),
    )
  );
}

function extractTopLevelCssBlocks(cssText) {
  const css = String(cssText ?? "");
  const blocks = [];
  let cursor = 0;
  let blockStart = 0;

  while (cursor < css.length) {
    const openIndex = findNextOpenBrace(css, cursor);
    if (openIndex < 0) {
      break;
    }

    const selector = css.slice(blockStart, openIndex).trim();
    const closeIndex = findMatchingCloseBrace(css, openIndex);
    if (!selector || closeIndex < 0) {
      break;
    }

    blocks.push({
      selector,
      text: css.slice(blockStart, closeIndex + 1),
      start: blockStart,
      end: closeIndex + 1,
    });

    cursor = closeIndex + 1;
    blockStart = cursor;
  }

  return blocks;
}

function findNextOpenBrace(cssText, startIndex) {
  let quote = "";
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = startIndex; index < cssText.length; index += 1) {
    const current = cssText[index];
    const next = cssText[index + 1];

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (current === "\\" && next) {
        index += 1;
        continue;
      }
      if (current === quote) {
        quote = "";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }

    if (current === "{") {
      return index;
    }
  }

  return -1;
}

function findMatchingCloseBrace(cssText, openIndex) {
  let depth = 0;
  let quote = "";
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = openIndex; index < cssText.length; index += 1) {
    const current = cssText[index];
    const next = cssText[index + 1];

    if (inLineComment) {
      if (current === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (current === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (current === "\\" && next) {
        index += 1;
        continue;
      }
      if (current === quote) {
        quote = "";
      }
      continue;
    }

    if (current === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }

    if (current === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }

    if (current === '"' || current === "'") {
      quote = current;
      continue;
    }

    if (current === "{") {
      depth += 1;
      continue;
    }

    if (current === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function normalizeCssSelector(selector) {
  return String(selector ?? "").replace(/\s+/g, " ").trim();
}

function normalizeModel(value) {
  const trimmed = String(value ?? "").trim();
  return /^[a-z0-9][a-z0-9.-]{1,127}$/i.test(trimmed) ? trimmed : null;
}

function normalizeAttachmentMimeType(mimeType, dataUrl) {
  const normalizedMimeType = String(mimeType ?? "").trim().toLowerCase();
  const dataUrlMatch = /^data:([^;,]+)[;,]/i.exec(String(dataUrl ?? "").trim());
  const dataUrlMimeType = String(dataUrlMatch?.[1] ?? "").trim().toLowerCase();

  if (normalizedMimeType && dataUrlMimeType && normalizedMimeType !== dataUrlMimeType) {
    return "";
  }

  return normalizedMimeType || dataUrlMimeType;
}

function approximateDataUrlBytes(dataUrl) {
  const [, base64 = ""] = String(dataUrl ?? "").split(",", 2);
  return Math.floor((base64.length * 3) / 4);
}

function normalizeAttachmentLimit(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 2_500_000;
}

function normalizeMaxOutputTokens(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : 25_000;
}

function formatMegabytes(bytes) {
  return (bytes / 1_000_000).toFixed(1).replace(/\.0$/, "");
}

function normalizeBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "true" || trimmed === "1" || trimmed === "on" || trimmed === "yes") {
      return true;
    }
    if (trimmed === "false" || trimmed === "0" || trimmed === "off" || trimmed === "no") {
      return false;
    }
  }

  return fallback;
}

function normalizeReasoningEffort(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }
  return ["none", "minimal", "low", "medium", "high", "xhigh"].includes(trimmed) ? trimmed : null;
}

function normalizeWidgetKey(value) {
  const trimmed = String(value ?? "booking_calendar").trim();
  return trimmed === "booking_calendar" || trimmed === "booking_page_view" ? trimmed : null;
}

function normalizeId(value) {
  const trimmed = String(value ?? "").trim();
  return UUID_PATTERN.test(trimmed) ? trimmed : null;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ALLOWED_FILE_MIME_TYPES = new Set(["application/pdf", "text/plain"]);
