import "server-only";

import {
  TransactionalEmailError,
  type SendTransactionalEmailResult,
  type TransactionalEmailMessage,
  type TransactionalEmailProvider,
} from "./types";

export class ZeptoMailEmailProvider implements TransactionalEmailProvider {
  readonly driver = "zeptomail" as const;

  private readonly apiKey: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiKey = readRequiredEnv("ZEPTOMAIL_API_KEY");
    this.apiBaseUrl = process.env.ZEPTOMAIL_API_BASE_URL ?? "https://api.zeptomail.com";

    if (!process.env.EMAIL_FROM_ADDRESS) {
      throw new TransactionalEmailError(
        "EMAIL_FROM_ADDRESS is required when EMAIL_DRIVER is set to zeptomail.",
        { code: "configuration", retryable: false }
      );
    }
  }

  async send(_: TransactionalEmailMessage): Promise<SendTransactionalEmailResult> {
    void this.apiKey;
    void this.apiBaseUrl;

    throw new TransactionalEmailError(
      "ZeptoMail provider send is not implemented yet.",
      { code: "unknown", retryable: false }
    );
  }
}

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new TransactionalEmailError(
      `${name} is required when EMAIL_DRIVER is set to zeptomail.`,
      { code: "configuration", retryable: false }
    );
  }

  return value;
}
