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
    // Clean the slug: remove 'onopo-', split by dashes
    const cleanSlug = slug.replace('onopo-', '').toLowerCase()

    // Stop words to ignore during search
    const stopWords = ['ve', 'ile', 'icin', 'cok', 'daha', 'en', 'hizli', 'guclu', 'sarj', 'kablo', 'usb', 'type', 'to', 'adaptoru', 'cihazi', 'arada', 'li', 'lu', 'u', 'in', 'katlanabilir', 'fonksiyonlu', 'guvenli', 'guvenlik']

    // Split into tokens
    const tokens = cleanSlug.split('-').filter(w => w.length > 1 && !stopWords.includes(w))

    if (tokens.length === 0) return null

    // Separate "Model Numbers" (tokens with digits) from regular words
    const modelTokens = tokens.filter(t => /\d/.test(t)) // e.g., '20000pa', '12w', '2.4a'
    const wordTokens = tokens.filter(t => !/\d/.test(t)) // e.g., 'supurge', 'siyah'

    // Build query conditions
    // We want to find candidates that match ANY of our important tokens
    const searchTokens = [...modelTokens, ...wordTokens]
    if (searchTokens.length === 0) return null

    const conditions = searchTokens.map(() => `slug LIKE ?`).join(' OR ')
    const bindValues = searchTokens.map(w => `%${w}%`)

    try {
        const query = `SELECT slug FROM products WHERE is_active = 1 AND (${conditions}) LIMIT 70`
        const { results: candidates } = await db.prepare(query).bind(...bindValues).all()

        if (!candidates || candidates.length === 0) return null

        // 3. Find Best Match in JS using Weighted Scoring
        let bestMatch = null
        let maxScore = 0

        for (const candidate of candidates) {
            const cSlug = (candidate as any).slug
            const cClean = cSlug.replace('onopo-', '').toLowerCase()
            const cTokens = cClean.split('-')

            let score = 0

            // Check Model Token Matches (High Value +10)
            let matchedModels = 0
            for (const mt of modelTokens) {
                // Approximate match for model numbers (e.g. 2.4a vs 24a)
                // Remove dots for comparison
                const mtSimple = mt.replace('.', '')

                const found = cTokens.some((ct: string) => {
                    const ctSimple = ct.replace('.', '')
                    return ct.includes(mt) || mt.includes(ct) || ctSimple === mtSimple
                })

                if (found) {
                    score += 15
                    matchedModels++
                }
            }

            // Check Word Token Matches (Low Value +2)
            for (const wt of wordTokens) {
                if (cTokens.some((ct: string) => ct.includes(wt) || wt.includes(ct))) {
                    score += 2
                }
            }

            // Penalize if candidate is missing model numbers that we searched for
            // If user searched for '20000pa', and candidate doesn't have it, it's a weak match
            // score logic handles this implicitly by not adding points

            // Boost if candidate starts with same word (excluding onopo)
            if (cClean.startsWith(cleanSlug.substring(0, 4))) {
                score += 3
            }

            if (score > maxScore) {
                maxScore = score
                bestMatch = cSlug
            }
        }

        // Threshold: Must have at least one strong match (15) or multiple weak matches
        // If we searched for a model number, we expect a high score
        const threshold = modelTokens.length > 0 ? 10 : 3

        if (maxScore >= threshold) return bestMatch

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

