import { Metadata } from "next"
import HomePageClient from "./HomePageClient"
import { getHomepageSections, getNewestProducts } from "@/lib/catalog"

// Static metadata for SEO and Open Graph
export const metadata: Metadata = {
  title: 'ONOPO Store - Teknoloji, Gaming & Kozmetik',
  description: 'ONOPO Store\'da en kaliteli teknoloji, gaming ve kozmetik ürünlerini en uygun fiyatlarla keşfedin. Hızlı kargo, güvenli ödeme.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'ONOPO Store',
    description: 'Teknoloji, Gaming & Kozmetik ürünlerinde en uygun fiyatlar.',
    type: 'website',
    url: '/',
    images: ['/og-image.jpg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ONOPO Store',
    description: 'Teknoloji, Gaming & Kozmetik ürünlerinde en uygun fiyatlar.',
    images: ['/og-image.jpg'],
  },
}

// Server Component: sections (Admin › Ana Sayfa) and their products are resolved on the server,
// so the HTML already contains the home content (no client fetch of /api/homepage-sections or
// /api/products?limit=200).
export default async function Home() {
  const sections = await getHomepageSections()
  const fallbackProducts = sections.length === 0 ? await getNewestProducts(8) : []
  return <HomePageClient sections={sections} fallbackProducts={fallbackProducts} />
}
