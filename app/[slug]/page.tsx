import { Metadata } from "next"
import { getDB } from "@/lib/db"
import { stripHtml } from "@/lib/stripHtml"
import SlugPageClient from "./SlugPageClient"

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

const CATEGORY_TITLES: Record<string, string> = {
    'tech': 'Teknoloji Ürünleri',
    'gaming': 'Gaming Ürünleri',
    'beauty': 'Güzellik & Kozmetik',
    'products': 'Tüm Ürünler',
    'new': 'Yeni Ürünler'
}

// Lightweight metadata generation for SEO
export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    try {
        const params = await props.params
        const slug = params.slug

        // Check if it's a category
        if (VALID_CATEGORIES.includes(slug)) {
            const title = CATEGORY_TITLES[slug] || 'Ürünler'
            return {
                title: `${title} - ONOPO`,
                description: `ONOPO Store'da ${title.toLowerCase()} kategorisindeki tüm ürünleri keşfedin.`,
                openGraph: {
                    title: `${title} - ONOPO`,
                    description: `ONOPO Store'da ${title.toLowerCase()} kategorisindeki tüm ürünleri keşfedin.`,
                    type: 'website',
                },
            }
        }

        // Check if it's a product
        const db = await getDB()
        const product = await db.prepare(
            'SELECT name, description, images FROM products WHERE slug = ? LIMIT 1'
        ).bind(slug).first() as any

        if (product) {
            const images = (() => {
                try { return JSON.parse(product.images || '[]') }
                catch { return [] }
            })()
            const mainImage = images[0] || '/og-image.png'
            const cleanDescription = stripHtml(product.description || 'ONOPO Store\'da en uygun fiyatlarla.', 160)

            return {
                title: `${product.name} - ONOPO`,
                description: cleanDescription,
                openGraph: {
                    title: product.name,
                    description: cleanDescription,
                    images: [mainImage],
                    type: 'website',
                },
                twitter: {
                    card: 'summary_large_image',
                    title: product.name,
                    description: cleanDescription,
                    images: [mainImage],
                },
            }
        }

        // Default
        return { title: 'ONOPO Store' }
    } catch (e) {
        console.error('Metadata generation error:', e)
        return { title: 'ONOPO Store' }
    }
}

// Server Component that renders the Client Component
export default async function Page(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params
    return <SlugPageClient slug={params.slug} />
}
