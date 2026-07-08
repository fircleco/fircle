import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readWorkspaceFile(relativePath: string): string {
  const fullPath = path.join(process.cwd(), relativePath);
  return readFileSync(fullPath, "utf8");
}

describe("Phase 5 brand lockup wiring", () => {
  it("wires branded lockup through app shell for app routes", () => {
    const appLayout = readWorkspaceFile("src/app/(app)/layout.tsx");

    expect(appLayout).toContain("<MembershipGuard primaryLockup={brandContext.primaryLockup}>");
    expect(appLayout).toContain("<DesktopSidebar primaryLockup={brandContext.primaryLockup} />");
    expect(appLayout).toContain("<MobileHeader primaryLockup={brandContext.primaryLockup} />");
  });

  it("keeps member profile route under branded app shell", () => {
    const memberProfilePage = readWorkspaceFile("src/app/(app)/member/[slug]/page.tsx");
    const appLayout = readWorkspaceFile("src/app/(app)/layout.tsx");

    expect(memberProfilePage).toContain("export default function MemberProfilePage()");
    expect(appLayout).toContain("{children}");
  });

  it("wires branded lockup across auth routes", () => {
    const authLanding = readWorkspaceFile("src/app/auth/page.tsx");
    const signinPage = readWorkspaceFile("src/app/auth/signin/page.tsx");
    const signinForm = readWorkspaceFile("src/components/auth/signin-form.tsx");
    const setupPage = readWorkspaceFile("src/app/auth/setup/page.tsx");

    expect(authLanding).toContain("{brandContext.primaryLockup}");
    expect(signinPage).toContain("<SignInForm primaryLockup={brandContext.primaryLockup} />");
    expect(signinForm).toContain("Enter your credentials for {primaryLockup}");
    expect(setupPage).toContain("<FirstFamilySetupForm primaryLockup={brandContext.primaryLockup} />");
  });
});
