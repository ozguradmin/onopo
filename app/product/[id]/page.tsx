import { Metadata } from "next"
import { getDB } from "@/lib/db"
import { stripHtml } from "@/lib/stripHtml"
import ProductPageClient from "./ProductPageClient"

// Lightweight metadata generation for SEO (runs on server, ~2-3ms CPU)
export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
    try {
        const params = await props.params
        const db = await getDB()
        const product = await db.prepare(
            'SELECT name, description, images FROM products WHERE id = ? LIMIT 1'
        ).bind(params.id).first() as any

        if (!product) {
            return { title: 'Ürün Bulunamadı - ONOPO' }
        }

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
    } catch (e) {
        console.error('Metadata generation error:', e)
        return { title: 'ONOPO Store' }
    }
}

// Server Component that renders the Client Component
export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    return <ProductPageClient id={params.id} />
}
