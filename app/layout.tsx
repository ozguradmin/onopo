import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from 'sonner';
import { LayoutProvider } from "@/components/layout/LayoutProvider";
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { JsonLd } from "@/components/ui/JsonLd";
import { getSiteSettings, getStorefrontData } from "@/lib/catalog";
import { organizationJsonLd, rootMetadata, websiteJsonLd } from "@/lib/seo";
import { getSiteSeo } from "@/lib/seo-server";
import { absoluteImageUrl } from "@/lib/images";
import "./globals.css";

// One variable family for the whole store (spec §5). latin-ext carries ğ ş İ Ş Ğ, so Turkish text
// never waits for a second font file.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

// Every page reads live data (site settings, maintenance flag, catalogue) from D1 at request time.
// Never prerender a page with build-time defaults.
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com';

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
};

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  // Favicon from Admin › Ayarlar (favicon_url), rendered by Next in <head> on the server; static fallback.
  const favicon = settings.favicon_url ? absoluteImageUrl(settings.favicon_url, BASE_URL) : null;

  // Title template, description, Open Graph, Twitter and robots defaults: lib/seo.ts (docs/SEO.md).
  // No canonical here: each page sets its own.
  return {
    ...rootMetadata,
    icons: favicon
      ? { icon: [{ url: favicon }], shortcut: [{ url: favicon }], apple: [{ url: favicon }] }
      : { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/favicon.svg', type: 'image/svg+xml' }] },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // One D1 batch per request: settings, shipping, categories (+counts), menus, payment flags.
  // Never throws: falls back to defaults so the shell always renders.
  const data = await getStorefrontData();
  // Organization (OnlineStore) and WebSite structured data; sameAs only lists the brand's own profiles.
  const site = await getSiteSeo();

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased bg-canvas text-ink pb-16 md:pb-0`}>
        <JsonLd data={[organizationJsonLd(site), websiteJsonLd(site)]} />
        <GlobalErrorBoundary variant="root">
          <LayoutProvider data={data}>
            {children}
          </LayoutProvider>
        </GlobalErrorBoundary>
        <Toaster />
      </body>
    </html>
  );
}
