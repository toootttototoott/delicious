import { getAppSettings } from "../lib/app-settings.js";
import { ensureSchema } from "../lib/db.js";
import { readBody, sendJson } from "../lib/http.js";
import {
  generateWidgetCssSuggestion,
  sanitizeWidgetEditorRequest,
} from "../lib/openai-widget.js";
import {
  getWidgetEditorContext,
  sanitizeWidgetThemeInput,
  upsertWidgetTheme,
} from "../lib/widget-themes.js";
import {
  deleteWidgetEditorPrompt,
  listWidgetEditorPrompts,
  sanitizeWidgetEditorPromptDeleteInput,
  sanitizeWidgetEditorPromptInput,
  saveWidgetEditorPrompt,
} from "../lib/widget-editor-prompts.js";
import { getSessionUserFromCookieHeader } from "../lib/users.js";

export default async function handler(request, response) {
  try {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }

    await ensureSchema();
    const session = await getSessionUserFromCookieHeader(request.headers.cookie);
    if (session?.authLevel !== "admin") {
      sendJson(response, 403, { error: "Admin access required." });
      return;
    }

    const body = await readBody(request);
    const action = body.action;

    if (action === "saveWidgetCss") {
      const input = sanitizeWidgetThemeInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const context = await getWidgetEditorContext(input.establishmentId, input.widgetKey);
      if (!context) {
        sendJson(response, 404, { error: "Selected establishment was not found." });
        return;
      }

      const theme = await upsertWidgetTheme(input.establishmentId, input.cssText, input.widgetKey);
      sendJson(response, 200, {
        message: input.widgetKey === "booking_page_view" ? "Booking page CSS saved." : "Widget CSS saved.",
        theme,
      });
      return;
    }

    if (action === "generateWidgetCss") {
      const appSettings = await getAppSettings();
      const input = sanitizeWidgetEditorRequest(body, {
        maxAttachmentBytes: appSettings.widgetEditorUploadLimitBytes,
      });
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const context = await getWidgetEditorContext(input.establishmentId, input.widgetKey);

      if (!context) {
        sendJson(response, 404, { error: "Selected establishment was not found." });
        return;
      }

      const suggestion = await generateWidgetCssSuggestion({
        model: input.model || appSettings.openAiModel,
        companyName: context.companyName,
        establishmentName: context.establishmentName,
        widgetKey: input.widgetKey,
        currentCss: input.useSavedCssBaseline ? context.cssText : input.currentCss,
        requestText: input.requestText,
        attachments: input.attachments,
        preserveExistingCss: input.useSavedCssBaseline,
        reasoningEffort: appSettings.openAiReasoningEffort,
        maxOutputTokens: appSettings.widgetEditorMaxOutputTokens,
      });

      sendJson(response, 200, {
        message: input.widgetKey === "booking_page_view" ? "Booking page CSS generated." : "Widget CSS generated.",
        cssText: suggestion.cssText,
        model: suggestion.model,
        usage: suggestion.usage,
        responseId: suggestion.responseId,
      });
      return;
    }

    if (action === "savePrompt") {
      const input = sanitizeWidgetEditorPromptInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const prompt = await saveWidgetEditorPrompt(input);
      if (!prompt) {
        sendJson(response, 404, { error: "Saved prompt was not found." });
        return;
      }

      const prompts = await listWidgetEditorPrompts(input.widgetKey);
      sendJson(response, 200, {
        message: input.promptId ? "Prompt updated." : "Prompt saved.",
        prompt,
        prompts,
      });
      return;
    }

    if (action === "deletePrompt") {
      const input = sanitizeWidgetEditorPromptDeleteInput(body);
      if (input.error) {
        sendJson(response, 400, { error: input.error });
        return;
      }

      const deleted = await deleteWidgetEditorPrompt(input);
      if (!deleted) {
        sendJson(response, 404, { error: "Saved prompt was not found." });
        return;
      }

      const prompts = await listWidgetEditorPrompts(input.widgetKey);
      sendJson(response, 200, {
        message: "Prompt deleted.",
        prompts,
      });
      return;
    }

    sendJson(response, 400, { error: "Unknown action." });
  } catch (error) {
    console.error("Widget editor API failed", error);
    sendJson(response, 500, {
      error: `Widget editor failed: ${error.message ?? "Unknown error."}`,
    });
  }
}
