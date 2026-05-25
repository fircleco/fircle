import { describe, expect, it } from "vitest";

import {
  buildClaimLinkCreatedTemplate,
  buildInviteCreatedTemplate,
} from "~/server/email/templates";

describe("buildInviteCreatedTemplate", () => {
  it("builds event-specific invite subject/body and action link", () => {
    const result = buildInviteCreatedTemplate({
      familyName: "Ng Family",
      inviteCode: "INVITE_CODE_123",
      appBaseUrl: "https://fircle.example.com",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(result.subject).toContain("Ng Family");
    expect(result.actionUrl).toBe("https://fircle.example.com/auth/invite/INVITE_CODE_123");
    expect(result.text).toContain("This link expires on Tue, 01 Jan 2030 00:00:00 GMT.");
    expect(result.html).toContain("Accept invite");
  });

  it("escapes html-sensitive dynamic content", () => {
    const result = buildInviteCreatedTemplate({
      familyName: "A & B <Family>",
      inviteCode: "code-123",
      appBaseUrl: "https://fircle.example.com",
      recipientName: "Alex \"Admin\"",
    });

    expect(result.html).toContain("A &amp; B &lt;Family&gt;");
    expect(result.html).toContain("Alex &quot;Admin&quot;");
  });
});

describe("buildClaimLinkCreatedTemplate", () => {
  it("builds event-specific claim subject/body and encoded claim link", () => {
    const result = buildClaimLinkCreatedTemplate({
      familyName: "Ng Family",
      memberName: "Grandma Mary",
      claimToken: "token/with space",
      appBaseUrl: "https://fircle.example.com",
      expiresAt: new Date("2031-02-03T04:05:06.000Z"),
    });

    expect(result.subject).toContain("Grandma Mary");
    expect(result.actionUrl).toBe("https://fircle.example.com/auth/claim/token%2Fwith%20space");
    expect(result.text).toContain("This link expires on Mon, 03 Feb 2031 04:05:06 GMT.");
    expect(result.html).toContain("Claim profile");
  });
});
