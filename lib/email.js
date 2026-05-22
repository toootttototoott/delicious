import nodemailer from "nodemailer";
import { smtpHost, smtpPass, smtpPort, smtpSecure, smtpUser } from "./config.js";
import { getBooking } from "./bookings.js";

const EMAIL_BRAND_NAME = "Pete N Joel Bookings";

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

async function sendBookingConfirmationEmail({ booking, recipientEmail }) {
  const emailSettings = getEmailSettingsSummary();
  if (!emailSettings.configured) {
    return {
      sent: false,
      reason: `SMTP is not fully configured. Missing: ${emailSettings.missingEnvVars.join(", ")}.`,
    };
  }

  const { subject, html, text } = renderBookingConfirmationEmail(booking);
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

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

function renderBookingConfirmationEmail(booking) {
  const venueName = booking.establishmentName || booking.companyName || "Your booking";
  const guestName = `${booking.firstName} ${booking.lastName}`.trim();
  const formattedDate = formatBookingDate(booking.bookingDate);
  const formattedTime = formatBookingTime(booking.bookingTime);
  const subject = `${venueName} booking confirmed for ${formattedDate}`;
  const details = [
    { label: "Booking reference", value: booking.id || "Pending" },
    { label: "Venue", value: venueName },
    booking.companyName && booking.companyName !== venueName
      ? { label: "Company", value: booking.companyName }
      : null,
    { label: "Guest", value: guestName },
    { label: "Date", value: formattedDate },
    { label: "Time", value: formattedTime },
    { label: "Party size", value: `${booking.partySize} guest${booking.partySize === 1 ? "" : "s"}` },
    { label: "Email", value: booking.email },
    { label: "Phone", value: booking.phone },
    booking.seatCount ? { label: "Slot capacity", value: `${booking.seatCount} seats` } : null,
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
                <div style="padding:32px;background:linear-gradient(135deg,#17352f 0%,#31584f 55%,#c86a3c 100%);color:#fffdf9;">
                  <p style="margin:0 0 10px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.86;">${escapeHtml(EMAIL_BRAND_NAME)}</p>
                  <h1 style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:700;">Booking confirmed</h1>
                  <p style="margin:0;font-size:16px;line-height:1.6;max-width:500px;">
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
                <p style="margin:0 0 10px;font-size:15px;line-height:1.7;color:#506058;">
                  If any details need to change, reply to this email and the team can assist.
                </p>
                <p style="margin:0;font-size:13px;line-height:1.6;color:#7b817d;">
                  This confirmation was sent from ${escapeHtml(EMAIL_BRAND_NAME)} using ${escapeHtml(smtpUser)}.
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
    "Reply to this email if you need to make a change.",
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
