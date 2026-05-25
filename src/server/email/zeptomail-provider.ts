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
  private readonly accountId: string;
  private readonly apiBaseUrl: string;

  constructor() {
    this.apiKey = env.ZEPTOMAIL_API_KEY
      ? String(env.ZEPTOMAIL_API_KEY)
      : missingConfig("ZEPTOMAIL_API_KEY");
    this.accountId = env.ZEPTOMAIL_ACCOUNT_ID
      ? String(env.ZEPTOMAIL_ACCOUNT_ID)
      : missingConfig("ZEPTOMAIL_ACCOUNT_ID");
    this.apiBaseUrl = env.ZEPTOMAIL_API_BASE_URL
      ? String(env.ZEPTOMAIL_API_BASE_URL)
      : "https://api.zeptomail.com";
  }

  async send(message: TransactionalEmailMessage): Promise<SendTransactionalEmailResult> {
    const endpoint = buildSendEndpoint(this.apiBaseUrl);
    const requestBody = buildRequestBody(message, this.accountId);

    console.info(
      `[tx-email:zeptomail:send-attempt] event=${message.event} to=${maskEmail(message.to.email)} accountId=${this.accountId} metadataKeys=${Object.keys(message.metadata ?? {}).length}`
    );

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Zoho-enczapikey ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error(
        `[tx-email:zeptomail:send-failed] event=${message.event} to=${maskEmail(message.to.email)} accountId=${this.accountId} code=provider-unavailable retryable=true reason=network-error`
      );
      throw new TransactionalEmailError(
        "ZeptoMail request failed before receiving a response.",
        { code: "provider-unavailable", retryable: true, cause: error }
      );
    }

    const payload = await parseJsonSafely(response);

    if (!response.ok) {
      const mappedError = mapZeptoMailError(response.status, payload);
      console.error(
        `[tx-email:zeptomail:send-failed] event=${message.event} to=${maskEmail(message.to.email)} accountId=${this.accountId} status=${response.status} code=${mappedError.code} retryable=${mappedError.retryable} requestId=${extractRequestId(payload) ?? "n/a"}`
      );
      throw mappedError;
    }

    const providerMessageId = extractProviderMessageId(payload);
    const requestId = extractRequestId(payload);

    console.info(
      `[tx-email:zeptomail:send-succeeded] event=${message.event} to=${maskEmail(message.to.email)} accountId=${this.accountId} status=${response.status} requestId=${requestId ?? "n/a"} providerMessageId=${providerMessageId ?? "n/a"}`
    );

    return {
      driver: this.driver,
      providerMessageId,
      acceptedAt: new Date(),
    };
  }
}

type ZeptoMailRequestBody = {
  from: {
    address: string;
    name?: string;
  };
  to: Array<{
    email_address: {
      address: string;
      name?: string;
    };
  }>;
  subject: string;
  htmlbody: string;
  textbody?: string;
  client_reference: string;
};

function buildRequestBody(
  message: TransactionalEmailMessage,
  accountId: string
): ZeptoMailRequestBody {
  return {
    from: {
      address: message.from.email,
      name: message.from.name,
    },
    to: [
      {
        email_address: {
          address: message.to.email,
          name: message.to.name,
        },
      },
    ],
    subject: message.subject,
    htmlbody: message.html,
    textbody: message.text,
    client_reference:
      message.metadata?.client_reference ?? `${accountId}:${message.event}:${Date.now()}`,
  };
}

function buildSendEndpoint(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/\/+$/, "")}/v1.1/email`;
}

async function parseJsonSafely(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function mapZeptoMailError(status: number, payload: unknown): TransactionalEmailError {
  const message = extractErrorMessage(payload) ?? `ZeptoMail request failed with status ${status}.`;

  if (status === 401 || status === 403) {
    return new TransactionalEmailError(message, {
      code: "authentication",
      retryable: false,
      cause: payload,
    });
  }

  if (status === 429) {
    return new TransactionalEmailError(message, {
      code: "rate-limit",
      retryable: true,
      cause: payload,
    });
  }

  if (status >= 500) {
    return new TransactionalEmailError(message, {
      code: "provider-unavailable",
      retryable: true,
      cause: payload,
    });
  }

  if (status >= 400 && status < 500) {
    return new TransactionalEmailError(message, {
      code: "invalid-request",
      retryable: false,
      cause: payload,
    });
  }

  return new TransactionalEmailError(message, {
    code: "unknown",
    retryable: status >= 500,
    cause: payload,
  });
}

function extractErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as {
    message?: unknown;
    error?: {
      message?: unknown;
    };
  };

  const topMessage = value.message;
  if (typeof topMessage === "string" && topMessage.length > 0) {
    return topMessage;
  }

  const nestedMessage = value.error?.message;
  if (typeof nestedMessage === "string" && nestedMessage.length > 0) {
    return nestedMessage;
  }

  return undefined;
}

function extractRequestId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as {
    request_id?: unknown;
    error?: {
      request_id?: unknown;
    };
  };

  if (typeof value.request_id === "string" && value.request_id.length > 0) {
    return value.request_id;
  }

  const nested = value.error?.request_id;
  if (typeof nested === "string" && nested.length > 0) {
    return nested;
  }

  return undefined;
}

function extractProviderMessageId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const value = payload as {
    data?: Array<{
      additional_info?: Array<{
        message_id?: unknown;
      }>;
    }>;
    request_id?: unknown;
  };

  const fromAdditionalInfo = value.data?.[0]?.additional_info?.[0]?.message_id;
  if (typeof fromAdditionalInfo === "string" && fromAdditionalInfo.length > 0) {
    return fromAdditionalInfo;
  }

  if (typeof value.request_id === "string" && value.request_id.length > 0) {
    return value.request_id;
  }

  return undefined;
}

function maskEmail(email: string): string {
  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return "invalid-email";
  }

  if (localPart.length <= 2) {
    return `**@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

function missingConfig(name: string): never {
  throw new TransactionalEmailError(
    `${name} is required when EMAIL_DRIVER is set to zeptomail.`,
    { code: "configuration", retryable: false }
  );
}
