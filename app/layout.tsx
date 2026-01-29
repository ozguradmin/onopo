import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { MobileNav } from "@/components/layout/MobileNav";
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
  return (
    <html lang="tr">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased selection:bg-accent selection:text-white pb-16 md:pb-0`}
      >
        <Header />
        <CartDrawer />
        <main className="min-h-screen pt-16">
          {children}
        </main>
        <Footer />
        <MobileNav />
        <Toaster />
      </body>
    </html>
  );
}
