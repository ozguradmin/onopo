import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { LayoutProvider } from "@/components/layout/LayoutProvider";
import { DynamicFavicon } from "@/components/layout/DynamicFavicon";
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary';
import { Toaster } from 'sonner';
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'),
  title: {
    default: "Onopo Store | Teknoloji ve Yaşam",
    template: "%s | Onopo Store"
  },
  description: "En yeni teknoloji aksesuarları, premium yaşam ürünleri ve daha fazlası Onopo Store'da. Güvenli ödeme ve hızlı kargo.",
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
        width: 1200,
        height: 630,
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
  verification: {
    google: 'google-verification-code', // User to fill
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'

  // Organization structured data for SEO
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Onopo Store",
    "url": baseUrl,
    "logo": `${baseUrl}/logo.png`,
    "description": "En yeni teknoloji aksesuarları, premium yaşam ürünleri ve daha fazlası",
    "sameAs": [
      "https://www.instagram.com/onopostore",
      "https://www.facebook.com/onopostore",
      "https://twitter.com/onopostore"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+90-XXX-XXX-XXXX",
      "contactType": "customer service",
      "availableLanguage": "Turkish"
    }
  }

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "Onopo Store",
    "url": baseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/products?search={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  }

  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        {/* Favicon and Icons */}
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#4F46E5" />

        {/* SEO Links */}
        <link rel="canonical" href={baseUrl} />
        <link rel="alternate" type="application/rss+xml" title="Onopo Product Feed" href={`${baseUrl}/api/feeds/google`} />
        <link rel="alternate" type="application/atom+xml" title="Google Merchant Feed" href={`${baseUrl}/api/feeds/google`} />

        {/* Preconnect for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
        {/* Global Error Handler for removeChild hydration errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var reloadAttempted = false;
                window.onerror = function(msg, url, line, col, error) {
                  if (!reloadAttempted && msg && (
                    msg.indexOf('removeChild') !== -1 || 
                    msg.indexOf('properties of null') !== -1 ||
                    msg.indexOf('insertBefore') !== -1 ||
                    msg.indexOf('appendChild') !== -1
                  )) {
                    reloadAttempted = true;
                    console.log('[ErrorRecovery] Detected hydration error, forcing reload...');
                    window.location.reload();
                    return true;
                  }
                  return false;
                };
                window.addEventListener('unhandledrejection', function(event) {
                  if (!reloadAttempted && event.reason && event.reason.message && (
                    event.reason.message.indexOf('removeChild') !== -1 ||
                    event.reason.message.indexOf('properties of null') !== -1
                  )) {
                    reloadAttempted = true;
                    console.log('[ErrorRecovery] Detected unhandled hydration error, forcing reload...');
                    window.location.reload();
                  }
                });
              })();
            `
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased selection:bg-accent selection:text-white pb-16 md:pb-0`}
      >
        <GlobalErrorBoundary>
          <LayoutProvider>
            <DynamicFavicon />
            {children}
          </LayoutProvider>
          <Toaster />
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}

