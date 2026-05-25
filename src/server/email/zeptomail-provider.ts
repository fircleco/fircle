import "server-only";

import { env } from "~/env";

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
    this.apiKey = env.ZEPTOMAIL_API_KEY
      ? String(env.ZEPTOMAIL_API_KEY)
      : missingConfig("ZEPTOMAIL_API_KEY");
    this.apiBaseUrl = env.ZEPTOMAIL_API_BASE_URL
      ? String(env.ZEPTOMAIL_API_BASE_URL)
      : "https://api.zeptomail.com";
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

function missingConfig(name: string): never {
  throw new TransactionalEmailError(
    `${name} is required when EMAIL_DRIVER is set to zeptomail.`,
    { code: "configuration", retryable: false }
  );
}
