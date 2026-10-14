import { Metadata } from "next"
import { cache } from "react"
import { getDB } from "@/lib/db"
import { stripHtml } from "@/lib/stripHtml"
import { roundPrice } from "@/lib/roundPrice"
import SlugPageClient from "./SlugPageClient"

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

const CATEGORY_TITLES: Record<string, string> = {
    'tech': 'Teknoloji Ürünleri',
    'gaming': 'Gaming Ürünleri',
    'beauty': 'Güzellik & Kozmetik',
    'products': 'Tüm Ürünler',
    'new': 'Yeni Ürünler'
}

const R2_CUSTOM_DOMAIN = 'https://images.onopostore.com'

function resolveImageUrl(url: string): string {
    if (!url) return 'https://onopostore.com/og-image.png'
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/api/images/')) return `${R2_CUSTOM_DOMAIN}/${url.replace('/api/images/', '')}`
    if (!url.startsWith('/')) return `${R2_CUSTOM_DOMAIN}/${url}`
    return `https://onopostore.com${url}`
}

// Fetch product data from DB (shared between metadata and page)
const getProductBySlug = cache(async (slug: string) => {
    try {
        const db = await getDB()
        const product = await db.prepare(
            'SELECT id, name, description, images, price, original_price, stock, product_code, category, slug FROM products WHERE slug = ? LIMIT 1'
        ).bind(slug).first() as any
        return product || null
    } catch {
        return null
    }
})

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
        const product = await getProductBySlug(slug)

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
    const slug = params.slug

    // If it's a category, no product data needed
    if (VALID_CATEGORIES.includes(slug)) {
        return <SlugPageClient slug={slug} initialPageType="category" />
    }

    // Fetch product data server-side for structured data
    const product = await getProductBySlug(slug)

    if (!product) {
        return <SlugPageClient slug={slug} /> // No initialPageType — let client try fuzzy search
    }

    const images = (() => {
        try { return JSON.parse(product.images || '[]') }
        catch { return [] }
    })()
    const mainImage = resolveImageUrl(images[0] || '')
    const cleanDescription = stripHtml(product.description || '', 500)
    const productUrl = `https://onopostore.com/${product.slug}/`

    // Fiyatları sitedeki gösterimle aynı şekilde yuvarla
    const displayPrice = roundPrice(product.price)
    const displayOriginalPrice = product.original_price ? roundPrice(product.original_price) : null

    // JSON-LD Product Schema
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.name,
        "description": cleanDescription,
        "image": images.map((img: string) => resolveImageUrl(img)),
        "sku": product.product_code || `ONOPO-${product.id}`,
        "brand": {
            "@type": "Brand",
            "name": "ONOPO"
        },
        "url": productUrl,
        "offers": {
            "@type": "Offer",
            "url": productUrl,
            "priceCurrency": "TRY",
            "price": displayPrice.toFixed(2),
            "priceValidUntil": new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            "availability": product.stock > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            "seller": {
                "@type": "Organization",
                "name": "Onopo Store"
            }
        },
        ...(product.category ? { "category": product.category } : {})
    }

    // Fiyat formatla (Türk lokali)
    const formattedPrice = displayPrice.toLocaleString('tr-TR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }) + ' ₺'
    const formattedOriginalPrice = displayOriginalPrice
        ? displayOriginalPrice.toLocaleString('tr-TR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + ' ₺'
        : null

    return (
        <>
            {/* JSON-LD Product Schema — Akakçe, Google, botlar için */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd, null, 2) }}
            />

            {/* Ürün bilgileri — HTML kaynağında okunabilir formatta, botlar/crawlerlar için */}
            <div
                id="product-info"
                style={{ display: 'none' }}
                dangerouslySetInnerHTML={{
                    __html: [
                        '',
                        `  <h1 id="product-name">${product.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</h1>`,
                        `  <span id="product-price">${formattedPrice}</span>`,
                        ...(formattedOriginalPrice && displayOriginalPrice && displayOriginalPrice > displayPrice
                            ? [`  <span id="product-original-price">${formattedOriginalPrice}</span>`]
                            : []),
                        `  <span id="product-sku">${(product.product_code || `ONOPO-${product.id}`).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`,
                        `  <span id="product-stock">${product.stock > 0 ? 'Stokta' : 'Tükendi'}</span>`,
                        `  <span id="product-category">${(product.category || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`,
                        ...images.map((img: string, i: number) =>
                            `  <img id="product-image-${i + 1}" src="${resolveImageUrl(img)}" alt="${product.name.replace(/"/g, '&quot;')}" />`
                        ),
                        `  <a id="add-to-cart" href="/cart?add=${product.id}">Sepete Ekle</a>`,
                        `  <a id="buy-now" href="/checkout?product=${product.id}">Hemen Al</a>`,
                        ''
                    ].join('\n')
                }}
            />

            <SlugPageClient slug={slug} initialProductId={String(product.id)} initialPageType="product" />
        </>
    )
}
