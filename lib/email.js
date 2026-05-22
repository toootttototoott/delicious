import nodemailer from "nodemailer";
import { smtpHost, smtpPass, smtpPort, smtpSecure, smtpUser } from "./config.js";
import { getBooking } from "./bookings.js";

const EMAIL_BRAND_NAME = "Delicious Booking";

export function getEmailSettingsSummary() {
  const missingEnvVars = [
    !smtpHost ? "SMTP_HOST" : "",
    !smtpPort ? "SMTP_PORT" : "",
    !smtpUser ? "SMTP_USER" : "",
    !smtpPass ? "SMTP_PASS" : "",
  ].filter(Boolean);

  return {
    configured: missingEnvVars.length === 0,
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    user: smtpUser,
    fromAddress: smtpUser,
    missingEnvVars,
  };
}

export function sanitizeBookingConfirmationTestInput(body) {
  const recipientEmail = normalizeEmail(body.recipientEmail);
  const guestEmail = normalizeEmail(body.guestEmail);
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const companyName = String(body.companyName ?? "").trim();
  const establishmentName = String(body.establishmentName ?? "").trim();
  const bookingDate = normalizeDate(body.bookingDate);
  const bookingTime = normalizeTime(body.bookingTime);
  const partySize = Number(body.partySize);
  const notes = String(body.notes ?? "").trim();

  if (!recipientEmail) {
    return { error: "Enter a valid email address to send the test to." };
  }

  if (!firstName || !lastName || !guestEmail || !phone) {
    return { error: "Guest first name, last name, email, and phone are required." };
  }

  if (!establishmentName) {
    return { error: "Establishment name is required." };
  }

  if (!bookingDate || !bookingTime) {
    return { error: "Booking date and time are required." };
  }

  if (!Number.isInteger(partySize) || partySize <= 0) {
    return { error: "Party size must be a positive whole number." };
  }

  return {
    recipientEmail,
    booking: {
      id: buildTestBookingReference(),
      bookingDate,
      bookingTime,
      firstName,
      lastName,
      email: guestEmail,
      phone,
      partySize,
      notes,
      companyName,
      establishmentName,
      seatCount: null,
    },
  };
}

export function sanitizeBookingEnquiryInput(body) {
  const seatCountId = String(body.seatCountId ?? "").trim();
  const recipientEmail = normalizeEmail(body.recipientEmail);
  const companyName = String(body.companyName ?? "").trim();
  const establishmentName = String(body.establishmentName ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = normalizeEmail(body.email);
  const phone = String(body.phone ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const bookingDate = normalizeDate(body.bookingDate);
  const bookingTime = normalizeTime(body.bookingTime);
  const partySize = Number(body.partySize);

  if (!seatCountId) {
    return { error: "Seat count is required." };
  }

  if (!recipientEmail) {
    return { error: "This company does not have a valid enquiry email configured." };
  }

  if (!firstName || !lastName || !email || !phone) {
    return { error: "First name, last name, email, and phone are required." };
  }

  if (!Number.isInteger(partySize) || partySize <= 0) {
    return { error: "Party size must be a positive whole number." };
  }

  return {
    seatCountId,
    recipientEmail,
    enquiry: {
      companyName,
      establishmentName,
      firstName,
      lastName,
      email,
      phone,
      partySize,
      bookingDate,
      bookingTime,
      notes,
    },
  };
}

export async function sendBookingConfirmationForBooking(bookingId) {
  const booking = await getBooking(bookingId);
  if (!booking) {
    throw new Error("Booking not found.");
  }

  return sendBookingConfirmationEmail({
    booking,
    recipientEmail: booking.email,
  });
}

export async function sendBookingConfirmationTestEmail(input) {
  return sendBookingConfirmationEmail({
    booking: input.booking,
    recipientEmail: input.recipientEmail,
  });
}

export async function sendPasswordResetEmail(input) {
  const emailSettings = getEmailSettingsSummary();
  if (!emailSettings.configured) {
    return {
      sent: false,
      reason: `SMTP is not fully configured. Missing: ${emailSettings.missingEnvVars.join(", ")}.`,
    };
  }

  const { subject, html, text } = renderPasswordResetEmail(input);
  const transporter = createTransporter();

  const result = await transporter.sendMail({
    from: formatFromAddress(),
    to: input.recipientEmail,
    replyTo: smtpUser,
    subject,
    html,
    text,
  });

  return {
    sent: true,
    messageId: result.messageId ?? "",
  };
}

export async function sendBookingEnquiryEmail(input) {
  const emailSettings = getEmailSettingsSummary();
  if (!emailSettings.configured) {
    return {
      sent: false,
      reason: `SMTP is not fully configured. Missing: ${emailSettings.missingEnvVars.join(", ")}.`,
    };
  }

  const { subject, html, text } = renderBookingEnquiryEmail(input.enquiry);
  const transporter = createTransporter();
  const result = await transporter.sendMail({
    from: formatFromAddress(),
    to: input.recipientEmail,
    replyTo: input.enquiry.email,
    subject,
    html,
    text,
  });

  return {
    sent: true,
    messageId: result.messageId ?? "",
  };
}

async function sendBookingConfirmationEmail({ booking, recipientEmail }) {
  const emailSettings = getEmailSettingsSummary();
  if (!emailSettings.configured) {
    return {
      sent: false,
      reason: `SMTP is not fully configured. Missing: ${emailSettings.missingEnvVars.join(", ")}.`,
    };
  }

  const { subject, html, text } = renderBookingConfirmationEmail(booking);
  const transporter = createTransporter();

  const result = await transporter.sendMail({
    from: formatFromAddress(),
    to: recipientEmail,
    replyTo: smtpUser,
    subject,
    html,
    text,
  });

  return {
    sent: true,
    messageId: result.messageId ?? "",
  };
}

function renderBookingEnquiryEmail(enquiry) {
  const venueName = enquiry.establishmentName || enquiry.companyName || "Booking enquiry";
  const guestName = `${enquiry.firstName} ${enquiry.lastName}`.trim();
  const formattedDate = enquiry.bookingDate ? formatBookingDate(enquiry.bookingDate) : "Not provided";
  const formattedTime = enquiry.bookingTime ? formatBookingTime(enquiry.bookingTime) : "Flexible";
  const notesValue = enquiry.notes?.trim() || "No additional details were added.";
  const subject = `${venueName} enquiry for ${enquiry.partySize} guests`;
  const details = [
    { label: "Venue", value: venueName },
    { label: "Guest", value: guestName },
    { label: "Party size", value: `${enquiry.partySize} guest${enquiry.partySize === 1 ? "" : "s"}` },
    { label: "Preferred date", value: formattedDate },
    { label: "Preferred time", value: formattedTime },
    { label: "Email", value: enquiry.email },
    { label: "Phone", value: enquiry.phone },
  ];

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4efe8;color:#1e2722;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe8;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf9;border:1px solid #e7ddd1;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px;background:#f6efe4;border-bottom:1px solid #e7ddd1;color:#17352f;">
                <p style="display:inline-block;margin:0 0 12px;padding:7px 12px;border-radius:999px;background:#17352f;color:#fffdf9;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">${escapeHtml(EMAIL_BRAND_NAME)}</p>
                <h1 style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:700;color:#17352f;">New booking enquiry</h1>
                <p style="margin:0;font-size:16px;line-height:1.6;max-width:520px;color:#2d3d37;">
                  ${escapeHtml(guestName)} sent an enquiry for ${escapeHtml(venueName)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  ${details.map(renderEmailDetailRow).join("")}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;">
                <div style="border-radius:20px;background:#f8f3ec;border:1px solid #eadfce;padding:20px;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5d4b;">Enquiry details</p>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:#2a352f;">${escapeHtml(notesValue)}</p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "New booking enquiry",
    "",
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    "",
    `Enquiry details: ${notesValue}`,
  ].join("\n");

  return { subject, html, text };
}

function renderBookingConfirmationEmail(booking) {
  const venueName = booking.establishmentName || booking.companyName || "Your booking";
  const guestName = `${booking.firstName} ${booking.lastName}`.trim();
  const formattedDate = formatBookingDate(booking.bookingDate);
  const formattedTime = formatBookingTime(booking.bookingTime);
  const subject = `${venueName} booking confirmed for ${formattedDate}`;
  const details = [
    { label: "Venue", value: venueName },
    { label: "Guest", value: guestName },
    { label: "Date", value: formattedDate },
    { label: "Time", value: formattedTime },
    { label: "Party size", value: `${booking.partySize} guest${booking.partySize === 1 ? "" : "s"}` },
    { label: "Email", value: booking.email },
    { label: "Phone", value: booking.phone },
  ].filter(Boolean);

  const notesValue = booking.notes?.trim() || "No special requests were added.";
  const previewText = `Booking confirmed for ${guestName} on ${formattedDate} at ${formattedTime}.`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4efe8;color:#1e2722;font-family:Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe8;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf9;border:1px solid #e7ddd1;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:0;">
                <div style="padding:32px;background:#f6efe4;border-bottom:1px solid #e7ddd1;color:#17352f;">
                  <p style="display:inline-block;margin:0 0 12px;padding:7px 12px;border-radius:999px;background:#17352f;color:#fffdf9;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">${escapeHtml(EMAIL_BRAND_NAME)}</p>
                  <h1 style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:700;color:#17352f;">Booking confirmed</h1>
                  <p style="margin:0;font-size:16px;line-height:1.6;max-width:500px;color:#2d3d37;">
                    ${escapeHtml(guestName)}, your reservation at ${escapeHtml(venueName)} has been locked in for ${escapeHtml(formattedDate)} at ${escapeHtml(formattedTime)}.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 12px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 10px;">
                  ${details.map(renderEmailDetailRow).join("")}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <div style="border-radius:20px;background:#f8f3ec;border:1px solid #eadfce;padding:20px;">
                  <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#7a5d4b;">Special requests</p>
                  <p style="margin:0;font-size:15px;line-height:1.7;color:#2a352f;">${escapeHtml(notesValue)}</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;">
                <p style="margin:0;font-size:13px;line-height:1.6;color:#7b817d;">
                  dont reply - Auto Generated.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Booking confirmed",
    "",
    `${guestName}, your reservation at ${venueName} has been confirmed.`,
    "",
    ...details.map((detail) => `${detail.label}: ${detail.value}`),
    "",
    `Special requests: ${notesValue}`,
    "",
    "dont reply - Auto Generated.",
  ].join("\n");

  return { subject, html, text };
}

function renderPasswordResetEmail(input) {
  const firstName = String(input.firstName ?? "there").trim() || "there";
  const subject = "Reset your password";
  const expiryLabel = input.expiresInLabel || "1 hour";
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4efe8;color:#1e2722;font-family:Arial,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe8;padding:28px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffdf9;border:1px solid #e7ddd1;border-radius:24px;overflow:hidden;">
            <tr>
              <td style="padding:32px;background:#f6efe4;border-bottom:1px solid #e7ddd1;color:#17352f;">
                <p style="display:inline-block;margin:0 0 12px;padding:7px 12px;border-radius:999px;background:#17352f;color:#fffdf9;font-size:12px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;">${escapeHtml(EMAIL_BRAND_NAME)}</p>
                <h1 style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:700;color:#17352f;">Reset your password</h1>
                <p style="margin:0;font-size:16px;line-height:1.6;max-width:520px;color:#2d3d37;">
                  ${escapeHtml(firstName)}, use the button below to choose a new password. This link expires in ${escapeHtml(expiryLabel)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <div style="border-radius:20px;background:#f8f3ec;border:1px solid #eadfce;padding:24px;">
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#2a352f;">
                    If you requested a password reset, continue using the secure link below.
                  </p>
                  <p style="margin:0 0 20px;">
                    <a href="${escapeHtml(input.resetLink)}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#17352f;color:#fffdf9;text-decoration:none;font-size:15px;font-weight:700;">Reset password</a>
                  </p>
                  <p style="margin:0;font-size:13px;line-height:1.7;color:#6c746f;word-break:break-all;">
                    ${escapeHtml(input.resetLink)}
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px;">
                <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:#506058;">
                  If you did not request this change, you can ignore this email.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#7b817d;">
                  dont reply - Auto Generated.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Reset your password",
    "",
    `${firstName}, use the link below to choose a new password.`,
    `This link expires in ${expiryLabel}.`,
    "",
    input.resetLink,
    "",
    "If you did not request this change, you can ignore this email.",
    "dont reply - Auto Generated.",
  ].join("\n");

  return { subject, html, text };
}

function renderEmailDetailRow(detail) {
  return `
    <tr>
      <td style="width:190px;padding:14px 16px;border-radius:16px 0 0 16px;background:#f8f3ec;color:#7a5d4b;font-size:13px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;">
        ${escapeHtml(detail.label)}
      </td>
      <td style="padding:14px 16px;border-radius:0 16px 16px 0;background:#fcfaf6;color:#1f2b26;font-size:15px;">
        ${escapeHtml(detail.value)}
      </td>
    </tr>
  `;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

function formatFromAddress() {
  return `"${EMAIL_BRAND_NAME}" <${smtpUser}>`;
}

function buildTestBookingReference() {
  return `TEST-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 12)}`;
}

function formatBookingDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    return String(value ?? "");
  }

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatBookingTime(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) {
    return String(value ?? "");
  }

  const date = new Date(Date.UTC(1970, 0, 1, Number(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat("en-AU", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function normalizeEmail(value) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : "";
}

function normalizeDate(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

function normalizeTime(value) {
  const trimmed = String(value ?? "").trim();
  return /^\d{2}:\d{2}$/.test(trimmed) ? trimmed : "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
