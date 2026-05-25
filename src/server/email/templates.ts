import { buildClaimUrl, buildInviteUrl } from "./link-builders";

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
  const familyName = sanitizeText(input.familyName);
  const recipientName = sanitizeText(input.recipientName);
  const actionUrl = buildInviteUrl(input.appBaseUrl, input.inviteCode);
  const expiryText = formatExpiryText(input.expiresAt);
  const intro = recipientName
    ? `Hi ${recipientName}, you've been invited to join ${familyName} on Fircle.`
    : `You've been invited to join ${familyName} on Fircle.`;

  const subject = `You're invited to join ${familyName} on Fircle`;
  const textLines = [
    intro,
    "",
    "Accept your invite:",
    actionUrl,
    expiryText ? `\n${expiryText}` : "",
    "",
    "If you were not expecting this email, you can ignore it.",
  ].filter((line) => line !== "");

  const html = renderHtmlTemplate({
    title: subject,
    intro,
    ctaLabel: "Accept invite",
    actionUrl,
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
  const familyName = sanitizeText(input.familyName);
  const memberName = sanitizeText(input.memberName);
  const recipientName = sanitizeText(input.recipientName);
  const actionUrl = buildClaimUrl(input.appBaseUrl, input.claimToken);
  const expiryText = formatExpiryText(input.expiresAt);
  const intro = recipientName
    ? `Hi ${recipientName}, claim your ${memberName} profile in ${familyName} on Fircle.`
    : `Claim your ${memberName} profile in ${familyName} on Fircle.`;

  const subject = `Claim your ${memberName} profile on Fircle`;
  const textLines = [
    intro,
    "",
    "Use your claim link:",
    actionUrl,
    expiryText ? `\n${expiryText}` : "",
    "",
    "If you were not expecting this email, you can ignore it.",
  ].filter((line) => line !== "");

  const html = renderHtmlTemplate({
    title: subject,
    intro,
    ctaLabel: "Claim profile",
    actionUrl,
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
  title: string;
  intro: string;
  ctaLabel: string;
  actionUrl: string;
  expiryText: string;
  footer: string;
}): string {
  const title = escapeHtml(input.title);
  const intro = escapeHtml(input.intro);
  const ctaLabel = escapeHtml(input.ctaLabel);
  const actionUrl = escapeHtml(input.actionUrl);
  const expiryText = input.expiryText ? `<p>${escapeHtml(input.expiryText)}</p>` : "";
  const footer = escapeHtml(input.footer);

  return [
    "<div>",
    `  <h1>${title}</h1>`,
    `  <p>${intro}</p>`,
    `  <p><a href=\"${actionUrl}\">${ctaLabel}</a></p>`,
    expiryText ? `  ${expiryText}` : "",
    `  <p>${footer}</p>`,
    "</div>",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
