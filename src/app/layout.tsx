import "~/styles/globals.css";

import { type Metadata, type Viewport } from "next";
import { Geist, Inter } from "next/font/google";
import { Suspense } from "react";

import { NavigationProgress } from "~/components/nav/navigation-progress";
import { PwaInstallPrompt } from "~/components/pwa/pwa-install-prompt";
import { PwaRegistration } from "~/components/pwa/pwa-registration";
import { ThemeProvider } from "~/components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: {
    default: "Fircle",
    template: "%s | Fircle",
  },
  description: "Family-first social network focused on private sharing and memory preservation.",
  applicationName: "Fircle",
  manifest: "/manifest.json",
  themeColor: "#0a0a0a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fircle",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  openGraph: {
    title: "Fircle",
    description: "Family-first social network focused on private sharing and memory preservation.",
    siteName: "Fircle",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fircle",
    description: "Family-first social network focused on private sharing and memory preservation.",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

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
