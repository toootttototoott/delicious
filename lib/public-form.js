const MIN_PUBLIC_FORM_FILL_MS = 2500;
const MAX_PUBLIC_FORM_AGE_MS = 1000 * 60 * 60 * 2;

export function sanitizePublicFormSubmissionMeta(body) {
  const honeypot = String(body.website ?? "").trim();
  const startedAt = Number(body.formStartedAt);
  const privacyConsent = normalizeCheckbox(body.privacyConsent);

  return {
    honeypot,
    startedAt,
    privacyConsent,
  };
}

export function validatePublicFormSubmissionMeta(meta) {
  if (meta.honeypot) {
    return { error: "We could not verify your submission. Please try again." };
  }

  if (!Number.isFinite(meta.startedAt) || meta.startedAt <= 0) {
    return { error: "We could not verify your submission. Please reload the page and try again." };
  }

  const ageMs = Date.now() - meta.startedAt;
  if (ageMs < MIN_PUBLIC_FORM_FILL_MS) {
    return { error: "Please take a moment to review your details and try again." };
  }

  if (ageMs > MAX_PUBLIC_FORM_AGE_MS) {
    return { error: "This form has expired. Please reload the page and try again." };
  }

  if (!meta.privacyConsent) {
    return { error: "Please agree to the privacy notice before submitting." };
  }

  return { ok: true };
}

function normalizeCheckbox(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "on", "yes"].includes(normalized);
}
