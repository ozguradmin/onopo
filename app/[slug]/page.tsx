import CategoryClient from "./CategoryClient"
import ProductClient from "../product/[id]/ProductClient"
import { notFound, redirect } from "next/navigation"
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

// Helper to find similar slug using fuzzy matching
async function findSimilarProduct(db: any, slug: string): Promise<string | null> {
    // 1. Try simple variations first (fastest)
    const exactVariations = []
    if (!slug.startsWith('onopo-')) exactVariations.push('onopo-' + slug)
    if (slug.startsWith('onopo-')) exactVariations.push(slug.substring(6))

    for (const variant of exactVariations) {
        const { results } = await db.prepare(
            `SELECT slug FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`
        ).bind(variant).all()
        if (results && results.length > 0) return (results[0] as any).slug
    }

    // 2. Fuzzy Search Strategy
    // Clean the slug: remove 'onopo-', split by dashes, remove common words
    const cleanSlug = slug.replace('onopo-', '').toLowerCase()
    const stopWords = ['ve', 'ile', 'icin', 'cok', 'daha', 'en', 'hizli', 'guclu', 'sarj', 'kablo', 'usb', 'type', 'to']
    const words = cleanSlug.split('-').filter(w => w.length > 2 && !stopWords.includes(w))

    if (words.length === 0) return null

    // Build values for bound parameters
    // We search for products that match AT LEAST ONE of the significant words
    const conditions = words.map(() => `slug LIKE ?`).join(' OR ')
    const bindValues = words.map(w => `%${w}%`)

    try {
        const query = `SELECT slug FROM products WHERE is_active = 1 AND (${conditions}) LIMIT 50`
        const { results: candidates } = await db.prepare(query).bind(...bindValues).all()

        if (!candidates || candidates.length === 0) return null

        // 3. Find Best Match in JS using Token Overlap Score
        let bestMatch = null
        let maxScore = 0

        for (const candidate of candidates) {
            const cSlug = (candidate as any).slug
            const cClean = cSlug.replace('onopo-', '').toLowerCase()
            const cWords = cClean.split('-') // Keep all words for candidate

            // Calculate overlap score
            let matchCount = 0
            for (const w of words) {
                // Check if search word is ANYWHERE in candidate token (handles 2.4a vs 24a)
                if (cWords.some((cw: string) => cw.includes(w) || w.includes(cw))) {
                    matchCount++
                }
            }

            // Calculate score purely based on number of matched significant words
            // Penalize candidates that are too long if they don't match many words? No.
            // Just prioritize highest match count.

            if (matchCount > maxScore) {
                maxScore = matchCount
                bestMatch = cSlug
            }
        }

        // Strict threshold: Must match at least 50% of significant words if we have many, or all if distinct
        // Example: '20000pa' (1 word). Match count 1.
        // Example: '20000pa-supurge' (2 words).

        if (maxScore > 0) return bestMatch
        return null
    } catch (err) {
        console.error('Fuzzy search error:', err)
        return null
    }
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

        // Product not found - try to find similar slug and redirect
        const similarSlug = await findSimilarProduct(db, params.slug)
        if (similarSlug) {
            redirect(`/${similarSlug}`)
        }
    } catch (e: any) {
        // Essential: Re-throw redirect error so Next.js can handle it
        if (e?.digest?.startsWith('NEXT_REDIRECT')) {
            throw e;
        }
        console.error('Product lookup error:', e)
    }

    // Neither category nor product found
    notFound()
}

