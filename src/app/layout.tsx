import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { headers } from "next/headers";
import { Geist, Inter } from "next/font/google";
import { Suspense } from "react";

import { NavigationProgress } from "~/components/nav/navigation-progress";
import { PwaInstallPrompt } from "~/components/pwa/pwa-install-prompt";
import { PwaRegistration } from "~/components/pwa/pwa-registration";
import { ThemeProvider } from "~/components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import { resolveBrandContextFromHeaders } from "~/lib/brand-context";
import { cn } from "~/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const brandContext = await resolveBrandContextFromHeaders(requestHeaders);

  return {
    title: {
      default: brandContext.primaryLockup,
      template: `%s | ${brandContext.primaryLockup}`,
    },
    description: brandContext.appDescription,
    applicationName: brandContext.primaryLockup,
    manifest: "/manifest.json",
    themeColor: "#0a0a0a",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: brandContext.primaryLockup,
    },
    formatDetection: {
      telephone: false,
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
    openGraph: {
      title: brandContext.primaryLockup,
      description: brandContext.appDescription,
      siteName: brandContext.primaryLockup,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: brandContext.primaryLockup,
      description: brandContext.appDescription,
    },
    icons: {
      icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
      shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
  };
}

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(geist.variable, "font-sans", inter.variable)}
    >
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <PwaRegistration />
            <PwaInstallPrompt />
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {children}
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
