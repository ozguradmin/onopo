import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from 'sonner';
import { LayoutProvider } from "@/components/layout/LayoutProvider";
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { JsonLd } from "@/components/ui/JsonLd";
import { getSiteSettings, getStorefrontData } from "@/lib/catalog";
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

  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: "Onopo Store | Teknoloji ve Yaşam",
      template: "%s | Onopo Store"
    },
    description: "En yeni teknoloji aksesuarları, premium yaşam ürünleri ve daha fazlası Onopo Store'da. Güvenli ödeme ve hızlı kargo.",
    icons: favicon
      ? { icon: [{ url: favicon }], shortcut: [{ url: favicon }], apple: [{ url: favicon }] }
      : { icon: [{ url: '/favicon.ico', sizes: 'any' }, { url: '/favicon.svg', type: 'image/svg+xml' }] },
    openGraph: {
      type: 'website',
      locale: 'tr_TR',
      url: '/',
      siteName: 'Onopo Store',
      title: 'Onopo Store | Teknoloji ve Yaşam',
      description: 'En yeni teknoloji aksesuarları, premium yaşam ürünleri ve daha fazlası.',
      images: [
        {
          url: '/og-image.jpg',
          width: 1024,
          height: 1024,
          alt: 'Onopo Store'
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Onopo Store',
      description: 'En yeni teknoloji aksesuarları ve premium ürünler.',
      creator: '@onopostore'
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
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
  const { settings } = data;

  const sameAs = [settings.facebook_url, settings.instagram_url, settings.twitter_url, settings.youtube_url, settings.linkedin_url, settings.tiktok_url]
    .filter(u => /^https?:\/\//i.test(u));

  // Organization structured data for SEO (values from Admin › Ayarlar)
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "name": "Onopo Store",
    "url": BASE_URL,
    "logo": settings.logo_url ? absoluteImageUrl(settings.logo_url, BASE_URL) : `${BASE_URL}/logo.png`,
    "description": settings.site_description || "En yeni teknoloji aksesuarları, premium yaşam ürünleri ve daha fazlası",
    ...(settings.footer_email ? { "email": settings.footer_email } : {}),
    ...(settings.footer_phone ? { "telephone": settings.footer_phone } : {}),
    ...(sameAs.length ? { "sameAs": sameAs } : {}),
    ...(settings.footer_phone || settings.footer_email ? {
      "contactPoint": {
        "@type": "ContactPoint",
        ...(settings.footer_phone ? { "telephone": settings.footer_phone } : {}),
        ...(settings.footer_email ? { "email": settings.footer_email } : {}),
        "contactType": "customer service",
        "availableLanguage": "Turkish"
      }
    } : {})
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Onopo Store",
    "url": BASE_URL,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${BASE_URL}/products/?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${jakarta.variable} font-sans antialiased bg-canvas text-ink pb-16 md:pb-0`}>
        <JsonLd data={organizationSchema} />
        <JsonLd data={webSiteSchema} />
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
