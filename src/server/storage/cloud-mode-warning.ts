import { env } from "~/env";

let hasWarnedAboutCloudR2Env = false;

export function warnAboutCloudModeR2Env(): void {
  if (env.NODE_ENV === "test" || env.SELF_HOSTED || hasWarnedAboutCloudR2Env) {
    return;
  }

  const hasAnyR2Env = [
    env.R2_ACCOUNT_ID,
    env.R2_BUCKET,
    env.R2_ACCESS_KEY_ID,
    env.R2_SECRET_ACCESS_KEY,
    env.R2_PUBLIC_BASE_URL,
  ].some((value) => Boolean(value?.trim()));

  if (!hasAnyR2Env) {
    return;
  }

  hasWarnedAboutCloudR2Env = true;
  console.warn(
    "Cloud mode detected with R2_* environment variables; these will be ignored. Configure owner-managed storage credentials in app settings instead.",
  );
}