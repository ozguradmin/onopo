import CategoryClient from "./CategoryClient"
import ProductClient from "../product/[id]/ProductClient"
import { notFound } from "next/navigation"
import { getDB } from "@/lib/db"

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

// Generate metadata for SEO
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
    const resolvedParams = await params

    // First check if it's a category
    if (VALID_CATEGORIES.includes(resolvedParams.slug)) {
        return { title: `${resolvedParams.slug.charAt(0).toUpperCase() + resolvedParams.slug.slice(1)} - ONOPO` }
    }

    // Try to find product by slug
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            `SELECT id, name, description, images, category FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`
        ).bind(resolvedParams.slug).all()

        if (results && results.length > 0) {
            const product = results[0] as any
            const images = typeof product.images === 'string' ? JSON.parse(product.images) : product.images || []

            return {
                title: `${product.name} - ONOPO`,
                description: product.description?.substring(0, 160) || `${product.name} en uygun fiyatlarla ONOPO'da!`,
                openGraph: {
                    title: product.name,
                    description: product.description?.substring(0, 160) || `${product.name} en uygun fiyatlarla ONOPO'da!`,
                    images: images[0] ? [images[0]] : [],
                },
            }
        }
    } catch (e) {
        console.error('Metadata error:', e)
    }

    return { title: 'ONOPO' }
}

export default async function Page(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params

    // If it's a valid category, show category page
    if (VALID_CATEGORIES.includes(params.slug)) {
        return <CategoryClient slug={params.slug} />
    }

    // Otherwise, try to find product by slug
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            `SELECT id FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`
        ).bind(params.slug).all()

        if (results && results.length > 0) {
            const product = results[0] as any
            return <ProductClient id={String(product.id)} />
        }
    } catch (e) {
        console.error('Product lookup error:', e)
    }

    // Neither category nor product found
    notFound()
}
