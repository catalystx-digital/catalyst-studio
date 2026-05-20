import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CatalystBranding } from "@/components/catalyst-branding";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { QueryProvider } from "@/lib/cms-export/query-provider";
import { SupabaseProvider } from "@/lib/supabase/provider";
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
  title: "Catalyst Studio - Website Builder & CMS for Agencies",
  description:
    "Build and manage client websites faster. Visual builder, CMS, and hosting for agencies and freelancers. Start free, no credit card required.",
  keywords: [
    "website builder",
    "CMS",
    "agency tools",
    "freelancer tools",
    "visual builder",
    "no-code",
    "web design",
  ],
  authors: [{ name: "Catalyst Studio" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://catalyst-studio.app",
    siteName: "Catalyst Studio",
    title: "Catalyst Studio - Build & Manage Client Websites Faster",
    description:
      "Ship client sites 3x faster with our visual builder and CMS. Trusted by 500+ agencies.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Catalyst Studio - Website Builder for Agencies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalyst Studio - Website Builder & CMS for Agencies",
    description:
      "Build and manage client websites faster. Visual builder, CMS, and hosting for agencies.",
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
          <SupabaseProvider initialSession={null}>
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
          </SupabaseProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
