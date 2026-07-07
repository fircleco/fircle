export type EmailDriver = "zeptomail";

export type TransactionalEmailEvent =
  | "invite-created"
  | "claim-link-created";

export type EmailAddress = {
  email: string;
  name?: string;
};

export type TransactionalEmailMessage = {
  event: TransactionalEmailEvent;
  to: EmailAddress;
  from: EmailAddress;
  subject: string;
  html: string;
  text?: string;
  metadata?: Record<string, string>;
};

export type SendTransactionalEmailResult = {
  driver: EmailDriver;
  providerMessageId?: string;
  acceptedAt: Date;
};

export type TransactionalEmailErrorCode =
  | "configuration"
  | "authentication"
  | "rate-limit"
  | "provider-unavailable"
  | "invalid-request"
  | "unknown";

export class TransactionalEmailError extends Error {
  readonly code: TransactionalEmailErrorCode;
  readonly retryable: boolean;
  override readonly cause?: unknown;

  constructor(
    message: string,
    options: {
      code: TransactionalEmailErrorCode;
      retryable: boolean;
      cause?: unknown;
    }
  ) {
    super(message);
    this.name = "TransactionalEmailError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.cause = options.cause;
  }
}

export interface TransactionalEmailProvider {
  readonly driver: EmailDriver;

  send(message: TransactionalEmailMessage): Promise<SendTransactionalEmailResult>;
}

// ---------------------------------------------------------------------------
// Email delivery status contract
// Used by invite and claim-link mutations to surface send outcome to callers.
// ---------------------------------------------------------------------------

/**
 * Canonical status values for a transactional email dispatch attempt.
 *
 * - `sent`    – Provider accepted the request.
 * - `skipped` – Send was intentionally not attempted (e.g. no provider configured,
 *               missing from-address, unresolved base URL).
 * - `failed`  – Send was attempted but the provider or network rejected it.
 */
export type EmailDeliveryStatus = "sent" | "skipped" | "failed";

/**
 * Stable reason codes returned to callers for skipped/failed sends.
 * Internal provider details are not exposed; use logs for deep diagnostics.
 */
export type EmailDeliveryReasonCode =
  | "provider_not_configured"
  | "missing_from_address"
  | "base_url_unresolved"
  | "provider_error";

/**
 * Structured delivery result attached to mutation responses whenever an
 * email-bound invite or claim link is created or retried.
 */
export type EmailDeliveryResult = {
  status: EmailDeliveryStatus;
  /** Present for `skipped` and `failed` states. */
  reasonCode?: EmailDeliveryReasonCode;
  /** User-safe summary. Do not include raw provider error messages. */
  message?: string;
  /** ISO timestamp when the provider accepted the request (only on `sent`). */
  acceptedAt?: string;
};
