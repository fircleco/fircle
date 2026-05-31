import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist, Inter } from "next/font/google";

import { NavigationProgress } from "~/components/nav/navigation-progress";
import { ThemeProvider } from "~/components/theme-provider";
import { TRPCReactProvider } from "~/trpc/react";
import { cn } from "~/lib/utils";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: {
    default: "Fircle",
    template: "%s | Fircle",
  },
  description: "Family-first social network focused on private sharing and memory preservation.",
  applicationName: "Fircle",
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
            <NavigationProgress />
            {children}
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
