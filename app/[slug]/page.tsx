import CategoryClient from "./CategoryClient"
import ProductClient from "../product/[id]/ProductClient"
import { notFound, redirect } from "next/navigation"
import { getDB } from "@/lib/db"

// CDN caching handled via Cache-Control headers
export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

import { stripHtml } from "@/lib/stripHtml"

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

            // Clean HTML tags from description
            const cleanDescription = stripHtml(product.description || `${product.name} en uygun fiyatlarla ONOPO'da!`)

            return {
                title: `${product.name} - ONOPO`,
                description: cleanDescription,
                openGraph: {
                    title: product.name,
                    description: cleanDescription,
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
// IMPROVED MATCHING: Handle common URL variations
async function findSimilarProduct(db: any, slug: string): Promise<string | null> {
    // 1. Try exact variations first (fastest)
    const exactVariations: string[] = []

    // Add/remove onopo- prefix
    if (!slug.startsWith('onopo-')) exactVariations.push('onopo-' + slug)
    if (slug.startsWith('onopo-')) exactVariations.push(slug.substring(6))

    // Normalize dots in model numbers: 3.5mm → 35mm
    const normalizedSlug = slug.replace(/(\d)\.(\d)/g, '$1$2')
    if (normalizedSlug !== slug) {
        exactVariations.push(normalizedSlug)
        if (!normalizedSlug.startsWith('onopo-')) exactVariations.push('onopo-' + normalizedSlug)
    }

    // Also try with onopo prefix + normalized
    const withPrefix = 'onopo-' + slug.replace('onopo-', '')
    const withPrefixNormalized = withPrefix.replace(/(\d)\.(\d)/g, '$1$2')
    if (!exactVariations.includes(withPrefixNormalized)) {
        exactVariations.push(withPrefixNormalized)
    }

    for (const variant of exactVariations) {
        const { results } = await db.prepare(
            `SELECT slug FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`
        ).bind(variant).all()
        if (results && results.length > 0) return (results[0] as any).slug
    }

    // 2. FUZZY Search Strategy
    // Clean the slug: remove 'onopo-', normalize dots, split by dashes
    const cleanSlug = slug
        .replace('onopo-', '')
        .replace(/(\d)\.(\d)/g, '$1$2')  // 3.5mm → 35mm for matching
        .toLowerCase()

    // Stop words to ignore during search
    const stopWords = ['ve', 'ile', 'icin', 'cok', 'daha', 'en', 'hizli', 'guclu', 'sarj', 'kablo', 'usb', 'type', 'to', 'adaptoru', 'cihazi', 'arada', 'li', 'lu', 'u', 'in', 'katlanabilir', 'fonksiyonlu', 'guvenli', 'guvenlik', 'tasinabilir', 'portatif', 'kablosuz', 'mini', 'arac', 'tekerlekli', 'cocuk', 'ayarlanabilir', 'yukseklikli', 'korumali', 'yas', 'yuksek', 'ses', 'kaliteli', 'kablolu', 'telefon', 'tablet', 'uyumlu']

    // Split into tokens
    const tokens = cleanSlug.split('-').filter(w => w.length > 1 && !stopWords.includes(w))

    if (tokens.length === 0) return null

    // Separate "Model Numbers" (tokens with digits) from regular words
    const modelTokens = tokens.filter(t => /\d/.test(t)) // e.g., '35mm', '12w', 'v5'
    const wordTokens = tokens.filter(t => !/\d/.test(t)) // e.g., 'kulaklik', 'siyah'

    // LESS STRICT: Allow matching even with just word tokens
    if (modelTokens.length === 0 && wordTokens.length < 2) {
        // Not enough info to make a confident match
        return null
    }

    // Build query conditions - require ALL model tokens if present
    let query: string
    let bindValues: string[]

    if (modelTokens.length > 0) {
        // STRICT: Require ALL model tokens to be present
        const conditions = modelTokens.map(() => `slug LIKE ?`).join(' AND ')
        bindValues = modelTokens.map(w => `%${w}%`)
        query = `SELECT slug FROM products WHERE is_active = 1 AND (${conditions}) LIMIT 20`
    } else {
        // No model tokens - require at least 2 word tokens to match
        const conditions = wordTokens.slice(0, 3).map(() => `slug LIKE ?`).join(' AND ')
        bindValues = wordTokens.slice(0, 3).map(w => `%${w}%`)
        query = `SELECT slug FROM products WHERE is_active = 1 AND (${conditions}) LIMIT 20`
    }

    try {
        const { results: candidates } = await db.prepare(query).bind(...bindValues).all()

        if (!candidates || candidates.length === 0) return null

        // 3. Find Best Match in JS using STRICT Weighted Scoring
        let bestMatch = null
        let maxScore = 0

        for (const candidate of candidates) {
            const cSlug = (candidate as any).slug
            const cClean = cSlug.replace('onopo-', '').toLowerCase()
            const cTokens = cClean.split('-')

            let score = 0
            let matchedModels = 0

            // Check Model Token Matches (MUST match ALL)
            for (const mt of modelTokens) {
                const mtSimple = mt.replace('.', '')

                const found = cTokens.some((ct: string) => {
                    const ctSimple = ct.replace('.', '')
                    // Strict comparison - must be exact or contain fully
                    return ct === mt || ctSimple === mtSimple ||
                        (ct.includes(mt) && mt.length >= 3) ||
                        (mt.includes(ct) && ct.length >= 3)
                })

                if (found) {
                    score += 20
                    matchedModels++
                }
            }

            // CRITICAL: If we have model tokens, ALL must match
            if (modelTokens.length > 0 && matchedModels !== modelTokens.length) {
                continue // Skip this candidate - doesn't match all model numbers
            }

            // Check Word Token Matches
            let matchedWords = 0
            for (const wt of wordTokens) {
                if (cTokens.some((ct: string) => ct === wt || (ct.includes(wt) && wt.length >= 3))) {
                    score += 3
                    matchedWords++
                }
            }

            // Boost if starts with same prefix
            if (cClean.startsWith(cleanSlug.substring(0, 6))) {
                score += 5
            }

            if (score > maxScore) {
                maxScore = score
                bestMatch = cSlug
            }
        }

        // STRICT Threshold: Require high confidence
        // Model tokens: Need all models matched (20 each) + at least some words
        // Word tokens only: Need at least 9 points (3 words matched)
        const threshold = modelTokens.length > 0 ? (modelTokens.length * 20) : 9

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

            // Fetch Shipping Settings
            const shippingSettings = await db.prepare(
                `SELECT free_shipping_threshold FROM shipping_settings LIMIT 1`
            ).first()
            const threshold = shippingSettings ? parseFloat(shippingSettings.free_shipping_threshold) : 500.00

            return <ProductClient id={String(product.id)} freeShippingThreshold={threshold} />
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

