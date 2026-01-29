import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { LayoutProvider } from "@/components/layout/LayoutProvider";
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
    <html lang="tr">
      <head>
        <link rel="canonical" href={baseUrl} />
        <link rel="alternate" type="application/rss+xml" title="Onopo Product Feed" href={`${baseUrl}/api/feed/products`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
        />
      </head>
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased selection:bg-accent selection:text-white pb-16 md:pb-0`}
      >
        <LayoutProvider>
          {children}
        </LayoutProvider>
        <Toaster />
      </body>
    </html>
  );
}

