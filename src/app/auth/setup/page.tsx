import { headers } from "next/headers";

import { FirstFamilySetupForm } from "~/components/auth/first-family-setup-form";
import { resolveBrandContextFromHeaders } from "~/lib/brand-context";

export default async function FirstFamilySetupPage() {
  const requestHeaders = await headers();
  const brandContext = await resolveBrandContextFromHeaders(requestHeaders);

  return <FirstFamilySetupForm primaryLockup={brandContext.primaryLockup} />;
}
