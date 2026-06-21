import bcrypt from "bcryptjs";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { normalizeEmail } from "~/lib/email";
import { resolveTenantFromHeaders } from "~/lib/tenant-resolution";
import { findTenantUserByEmail } from "~/lib/tenant-users";
import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      // ...other properties
      // role: UserRole;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  // Required for multi-tenant and proxy/CDN deployments:
  // NextAuth uses the incoming host to derive baseUrl for callbacks and cookies.
  // Without this, the app will reject requests from non-NEXTAUTH_URL hosts.
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = signInSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const tenantResolution = request
          ? await resolveTenantFromHeaders(request.headers)
          : null;

        if (tenantResolution?.state !== "resolved") {
          return null;
        }

        const { email, password } = parsed.data;
        const user = await findTenantUserByEmail(
          db,
          tenantResolution.family.id,
          normalizeEmail(email),
        );
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return user;
      },
    }),
  ],
  session: { strategy: "jwt" },

  // Cookie domain is intentionally absent so each tenant host gets its own
  // host-scoped cookie. Without this, subdomains under fircle.app could share
  // a session-token cookie if a domain attribute were set (cross-tenant bleed).
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        // domain: intentionally not set — browser scopes cookie to exact host
      },
    },
  },

  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub!,
      },
    }),

    // Prevent cross-tenant redirect leakage: only allow relative URLs or
    // URLs whose origin exactly matches the resolved tenant host (baseUrl).
    // trustHost: true ensures baseUrl is derived from the real incoming host.
    redirect: ({ url, baseUrl }) => {
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === new URL(baseUrl).origin) return url;
      } catch {
        // Malformed URL — fall through to baseUrl
      }
      return baseUrl;
    },
  },
} satisfies NextAuthConfig;
