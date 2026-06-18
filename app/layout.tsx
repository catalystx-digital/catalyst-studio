import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CatalystBranding } from "@/components/catalyst-branding";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { QueryProvider } from "@/lib/cms-export/query-provider";
import { AuthProvider } from "@/lib/auth/provider";
import { AccountMenu } from "@/components/ui/account-menu";
// HelpMenu removed - consolidated into AccountMenu (DASH-001 fix)
import { DesignSystemProvider } from "@/lib/studio/design-system";
import { DensityProvider } from "@/components/dashboard/density-context";
import "./globals.css";

// Force dynamic rendering for all routes to avoid SSG issues with hooks
export const dynamic = 'force-dynamic'

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Catalyst Studio - AI-powered Visual Website Studio & CMS",
  description:
    "AI-powered visual website studio and CMS. Simple local hackable demo: import live sites with AI, edit visually, preview instantly. Run standalone with GraphQL headless API or export to any CMS. Core features (builder, preview, modeling) work with one command — no paid services or API keys required.",
  keywords: [
    "AI website builder",
    "visual site builder",
    "headless CMS",
    "GraphQL CMS",
    "UCS GraphQL",
    "website import",
    "universal CMS export",
    "Optimizely",
    "Kontent.ai",
    "Contentstack",
    "content modeling",
    "design system",
    "React Flow builder",
    "open source CMS",
    "no-code CMS",
    "AI content migration",
  ],
  authors: [{ name: "Catalyst Studio" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://catalyst-studio.app",
    siteName: "Catalyst Studio",
    title: "Catalyst Studio - AI-powered Visual Website Studio & CMS",
    description:
      "Simple local hackable AI visual website studio and CMS. One-command local demo with seeded site (no keys). Visual builder + live preview + headless GraphQL UCS API + export providers (Optimizely, Kontent.ai, Contentstack, etc.).",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Catalyst Studio - AI-powered Visual Website Studio and CMS",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalyst Studio - AI-powered Visual Website Studio & CMS",
    description:
      "Simple local hackable demo: AI import, visual editing, live preview, headless GraphQL, universal export. Core runs with npm run verify:quickstart — no API keys needed.",
    images: ["/og-image.png"],
  },
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-256x256.png", sizes: "256x256", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#FF5500",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const isAuthPage = headersList.get("x-auth-page") === "1";
  const requestPath = headersList.get("x-request-path") ?? "/";
  // Hide global header on: site-builder, dashboard, and landing page (which has its own header)
  const hideGlobalHeader =
    requestPath.startsWith("/studio/site-builder") ||
    requestPath.startsWith("/studio/preview/site") ||
    requestPath.startsWith("/dashboard") ||
    requestPath === "/";
  const initialWebsiteId = headersList.get("x-website-id");

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <AuthProvider>
            {isAuthPage ? (
              <main id="main-content">{children}</main>
            ) : (
              <Providers initialWebsiteId={initialWebsiteId}>
                <DesignSystemProvider websiteId={initialWebsiteId || undefined}>
                  <DensityProvider>
                    {!hideGlobalHeader && (
                      <div className="flex items-center justify-between px-4 py-2">
                        <CatalystBranding />
                        {/* Single unified account menu (DASH-001 fix) */}
                        <AccountMenu />
                      </div>
                    )}
                    <main id="main-content">{children}</main>
                  </DensityProvider>
                </DesignSystemProvider>
              </Providers>
            )}
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
