import { TransactionalEmailError, type EmailDeliveryResult, type SendTransactionalEmailResult } from "./types";

/**
 * Build a `sent` delivery result from a successful provider response.
 */
export function buildSentDeliveryResult(result: SendTransactionalEmailResult): EmailDeliveryResult {
  return {
    status: "sent",
    acceptedAt: result.acceptedAt.toISOString(),
  };
}

/**
 * Build a `skipped` delivery result for intentional non-attempts.
 */
export function buildSkippedDeliveryResult(
  reason: "provider_not_configured" | "missing_from_address" | "base_url_unresolved",
): EmailDeliveryResult {
  const messages: Record<typeof reason, string> = {
    provider_not_configured: "Transactional email is not configured on this instance.",
    missing_from_address: "Email sender address is not configured.",
    base_url_unresolved: "App base URL could not be resolved; email was not sent.",
  };

  return {
    status: "skipped",
    reasonCode: reason,
    message: messages[reason],
  };
}

/**
 * Build a `failed` delivery result from a caught send error.
 *
 * Sensitive provider details are kept in logs only; the returned message is
 * user-safe and actionable.
 */
export function buildFailedDeliveryResult(error: unknown): EmailDeliveryResult {
  if (error instanceof TransactionalEmailError) {
    return {
      status: "failed",
      reasonCode: "provider_error",
      message: resolveUserSafeMessage(error),
    };
  }

  return {
    status: "failed",
    reasonCode: "provider_error",
    message: "Email could not be sent. Please retry or share the link manually.",
  };
}

function resolveUserSafeMessage(error: TransactionalEmailError): string {
  switch (error.code) {
    case "authentication":
      return "Email provider credentials are invalid. Contact your instance administrator.";
    case "rate-limit":
      return "Email provider rate limit reached. Please wait a moment and retry.";
    case "provider-unavailable":
      return "Email provider is temporarily unavailable. Please retry shortly.";
    case "invalid-request":
      return "Email could not be sent due to a configuration issue. Contact your instance administrator.";
    case "configuration":
      return "Email provider is not configured correctly. Contact your instance administrator.";
    default:
      return "Email could not be sent. Please retry or share the link manually.";
  }
}
