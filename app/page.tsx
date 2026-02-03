import { Metadata } from "next"
import HomePageClient from "./HomePageClient"

// Static metadata for SEO and Open Graph
export const metadata: Metadata = {
  title: 'ONOPO Store - Teknoloji, Gaming & Kozmetik',
  description: 'ONOPO Store\'da en kaliteli teknoloji, gaming ve kozmetik ürünlerini en uygun fiyatlarla keşfedin. Hızlı kargo, güvenli ödeme.',
  openGraph: {
    title: 'ONOPO Store',
    description: 'Teknoloji, Gaming & Kozmetik ürünlerinde en uygun fiyatlar.',
    type: 'website',
    images: ['/og-image.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ONOPO Store',
    description: 'Teknoloji, Gaming & Kozmetik ürünlerinde en uygun fiyatlar.',
    images: ['/og-image.png'],
  },
}

// Server Component that renders the Client Component
export default function Home() {
  return <HomePageClient />
}
