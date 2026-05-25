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
