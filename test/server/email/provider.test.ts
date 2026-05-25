import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedEnv = vi.hoisted(() => ({
  EMAIL_DRIVER: undefined as string | undefined,
}));

vi.mock("server-only", () => ({}));

vi.mock("~/env", () => ({
  env: mockedEnv,
}));

vi.mock("~/server/email/zeptomail-provider", () => ({
  ZeptoMailEmailProvider: class {
    readonly driver = "zeptomail" as const;
  },
}));

import {
  createEmailProvider,
  getEmailProvider,
  resetTransactionalEmailProviderForTests,
} from "~/server/email/provider";

describe("email provider factory", () => {
  beforeEach(() => {
    resetTransactionalEmailProviderForTests();
    mockedEnv.EMAIL_DRIVER = undefined;
    vi.restoreAllMocks();
  });

  it("returns null when no email driver is configured", () => {
    expect(createEmailProvider()).toBeNull();
    expect(getEmailProvider()).toBeNull();
  });

  it("creates a ZeptoMail provider when EMAIL_DRIVER is zeptomail", () => {
    mockedEnv.EMAIL_DRIVER = "zeptomail";

    const provider = createEmailProvider();

    expect(provider).not.toBeNull();
    expect(provider?.driver).toBe("zeptomail");
  });

  it("throws on unsupported EMAIL_DRIVER values", () => {
    mockedEnv.EMAIL_DRIVER = "invalid-driver";

    expect(() => createEmailProvider()).toThrow(/Unsupported EMAIL_DRIVER value/);
  });
});
