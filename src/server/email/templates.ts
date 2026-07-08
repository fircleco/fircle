import { buildClaimUrl, buildInviteUrl } from "./link-builders";
import { formatFamilyDisplayName } from "~/lib/family-name";

export type TransactionalEmailTemplate = {
  subject: string;
  html: string;
  text: string;
  actionUrl: string;
};

export type InviteCreatedTemplateInput = {
  familyName: string;
  inviteCode: string;
  appBaseUrl: string;
  recipientName?: string;
  expiresAt?: Date | null;
};

export type ClaimLinkCreatedTemplateInput = {
  familyName: string;
  memberName: string;
  claimToken: string;
  appBaseUrl: string;
  recipientName?: string;
  expiresAt?: Date | null;
};

export function buildInviteCreatedTemplate(
  input: InviteCreatedTemplateInput
): TransactionalEmailTemplate {
  const normalizedFamilyName = sanitizeText(input.familyName);
  const familyDisplayName = normalizedFamilyName
    ? formatFamilyDisplayName(normalizedFamilyName)
    : "your family";
  const recipientName = sanitizeText(input.recipientName);
  const actionUrl = buildInviteUrl(input.appBaseUrl, input.inviteCode);
  const logoUrl = new URL("/icon.svg", input.appBaseUrl).toString();
  const expiryText = formatExpiryText(input.expiresAt);
  const intro = recipientName
    ? `Hi ${recipientName}, you've been invited to join ${familyDisplayName} on Fircle.`
    : `You've been invited to join ${familyDisplayName} on Fircle.`;

  const subject = `You're invited to join ${familyDisplayName} on Fircle`;
  const textLines = [intro, "", "Accept your invite:", actionUrl];
  if (expiryText) {
    textLines.push("", expiryText);
  }
  textLines.push("", "If you were not expecting this email, you can ignore it.");

  const html = renderHtmlTemplate({
    eyebrow: "Family invite",
    title: "You are invited to join Fircle",
    intro,
    ctaLabel: "Accept invite",
    actionUrl,
    logoUrl,
    expiryText,
    footer: "If you were not expecting this email, you can ignore it.",
  });

  return {
    subject,
    html,
    text: textLines.join("\n"),
    actionUrl,
  };
}

export function buildClaimLinkCreatedTemplate(
  input: ClaimLinkCreatedTemplateInput
): TransactionalEmailTemplate {
  const normalizedFamilyName = sanitizeText(input.familyName);
  const familyDisplayName = normalizedFamilyName
    ? formatFamilyDisplayName(normalizedFamilyName)
    : "your family";
  const memberName = sanitizeText(input.memberName);
  const recipientName = sanitizeText(input.recipientName);
  const actionUrl = buildClaimUrl(input.appBaseUrl, input.claimToken);
  const logoUrl = new URL("/icon.svg", input.appBaseUrl).toString();
  const expiryText = formatExpiryText(input.expiresAt);
  const intro = recipientName
    ? `Hi ${recipientName}, claim your ${memberName} profile in ${familyDisplayName} on Fircle.`
    : `Claim your ${memberName} profile in ${familyDisplayName} on Fircle.`;

  const subject = `Claim your ${memberName} profile on Fircle`;
  const textLines = [intro, "", "Use your claim link:", actionUrl];
  if (expiryText) {
    textLines.push("", expiryText);
  }
  textLines.push("", "If you were not expecting this email, you can ignore it.");

  const html = renderHtmlTemplate({
    eyebrow: "Profile claim",
    title: "Your family profile is ready to claim",
    intro,
    ctaLabel: "Claim profile",
    actionUrl,
    logoUrl,
    expiryText,
    footer: "If you were not expecting this email, you can ignore it.",
  });

  return {
    subject,
    html,
    text: textLines.join("\n"),
    actionUrl,
  };
}

function sanitizeText(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value.trim();
}

function formatExpiryText(expiresAt?: Date | null): string {
  if (!expiresAt) {
    return "";
  }

  return `This link expires on ${expiresAt.toUTCString()}.`;
}

function renderHtmlTemplate(input: {
  eyebrow: string;
  title: string;
  intro: string;
  ctaLabel: string;
  actionUrl: string;
  logoUrl: string;
  expiryText: string;
  footer: string;
}): string {
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const ctaLabel = escapeHtml(input.ctaLabel);
  const actionUrl = escapeHtml(input.actionUrl);
  const logoUrl = escapeHtml(input.logoUrl);
  const introParts = splitIntro(intro);
  const expiryText = input.expiryText
    ? `<p style="margin: 14px 0 0; font-size: 12px; line-height: 1.6; color: #111111;">${escapeHtml(input.expiryText)}</p>`
    : "";
  const footer = escapeHtml(input.footer);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin: 0; padding: 0; background: #e5e7eb;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background: #e5e7eb; padding: 22px 12px 30px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 520px; background: #ffffff; border-radius: 4px; overflow: hidden; border: 1px solid #d1d5db;">
            <tr>
              <td style="padding: 0; background: #111111;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="padding: 14px 16px;">
                      <img src="${logoUrl}" width="50" alt="Fircle" style="display: block; width: 50px; height: auto; max-width: 100%; border: 0; outline: none; text-decoration: none;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding: 16px 16px 18px; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; color: #111111;">
                ${introParts.greetingHtml}
                <h1 style="margin: 0; font-size: 28px; line-height: 1.2; color: #111111;">${title}</h1>
                <p style="margin: 10px 0 0; font-size: 13px; line-height: 1.6; color: #374151;">${introParts.summaryHtml}</p>
                <p style="margin: 12px 0 0; font-size: 12px; line-height: 1.6; color: #4b5563;">Use the button below to continue.</p>

                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 14px;">
                  <tr>
                    <td align="center" style="border-radius: 999px; background: #111111;">
                      <a href="${actionUrl}" style="display: inline-block; padding: 10px 16px; border-radius: 999px; color: #ffffff; text-decoration: none; font-size: 13px; font-weight: 700; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">${ctaLabel}</a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 14px 0 0; font-size: 12px; line-height: 1.6; color: #4b5563;">
                  If the button does not work, open this link: <a href="${actionUrl}" style="text-decoration: underline; word-break: break-all;">${actionUrl}</a>
                </p>

                ${expiryText}

                <hr style="margin: 18px 0 12px; border: 0; border-top: 1px solid #d1d5db;" />
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #4b5563;">${footer}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function splitIntro(intro: string): {
  greetingHtml: string;
  summaryHtml: string;
} {
  const commaIndex = intro.indexOf(",");
  if (commaIndex > 0 && commaIndex < 40) {
    const greeting = intro.slice(0, commaIndex + 1);
    const summary = intro.slice(commaIndex + 1).trim();

    return {
      greetingHtml: `<p style="margin: 0 0 10px; font-size: 12px; line-height: 1.5; color: #4b5563;">${greeting}</p>`,
      summaryHtml: summary || intro,
    };
  }

  return {
    greetingHtml: "",
    summaryHtml: intro,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
