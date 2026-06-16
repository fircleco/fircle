import { describe, expect, it } from "vitest";

import { resolveUnauthenticatedAppRedirect } from "~/lib/bootstrap-routing";

describe("resolveUnauthenticatedAppRedirect", () => {
  it("routes fresh self-hosted instances to setup", () => {
    const result = resolveUnauthenticatedAppRedirect({
      callbackUrl: "/feed",
      isSelfHosted: true,
      hasExistingFamily: false,
    });

    expect(result).toBe("/auth/setup");
  });

  it("routes configured self-hosted instances to sign-in with callback", () => {
    const result = resolveUnauthenticatedAppRedirect({
      callbackUrl: "/feed",
      isSelfHosted: true,
      hasExistingFamily: true,
    });

    expect(result).toBe("/auth/signin?callbackUrl=%2Ffeed");
  });

  it("routes managed mode to sign-in without setup detour", () => {
    const result = resolveUnauthenticatedAppRedirect({
      callbackUrl: "/family/gallery",
      isSelfHosted: false,
      hasExistingFamily: false,
    });

    expect(result).toBe("/auth/signin?callbackUrl=%2Ffamily%2Fgallery");
  });
});
