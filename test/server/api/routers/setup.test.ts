import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedEnv = vi.hoisted(() => ({
  SELF_HOSTED: true,
}));

vi.mock("server-only", () => ({}));

vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("~/env", () => ({
  env: mockedEnv,
}));

import { setupRouter } from "~/server/api/routers/setup";

function createCaller(db: unknown) {
  return setupRouter.createCaller({
    db,
    session: null,
    headers: new Headers(),
  } as never);
}

describe("setupRouter.getBootstrapStatus", () => {
  beforeEach(() => {
    mockedEnv.SELF_HOSTED = true;
    vi.restoreAllMocks();
  });

  it("returns no setup required when running in managed mode", async () => {
    mockedEnv.SELF_HOSTED = false;
    const findFirst = vi.fn();

    const caller = createCaller({
      family: { findFirst },
    });

    await expect(caller.getBootstrapStatus()).resolves.toEqual({
      selfHosted: false,
      requiresSetup: false,
    });

    expect(findFirst).not.toHaveBeenCalled();
  });

  it("requires setup when self-hosted and no family exists", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);

    const caller = createCaller({
      family: { findFirst },
    });

    await expect(caller.getBootstrapStatus()).resolves.toEqual({
      selfHosted: true,
      requiresSetup: true,
    });

    expect(findFirst).toHaveBeenCalledWith({
      select: { id: true },
    });
  });

  it("does not require setup when self-hosted family already exists", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "fam-1" });

    const caller = createCaller({
      family: { findFirst },
    });

    await expect(caller.getBootstrapStatus()).resolves.toEqual({
      selfHosted: true,
      requiresSetup: false,
    });
  });
});
