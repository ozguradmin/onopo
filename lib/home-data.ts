/**
 * Server data for the home page (app/page.tsx). Builds on lib/catalog (one D1 round trip per data set
 * per request, shared with the layout through React cache) and adds the few home-only reads.
 *
 * Failure policy: every part is loaded on its own. A part that fails is left empty and its name is
 * added to `failed`, so the page still renders everything else and marks the HTML as not
 * edge-cacheable (data-onopo-nocache). Only when nothing at all could be loaded does the page throw.
 */
import 'server-only'
import { cache } from 'react'
import { getBucket, getDB } from '@/lib/db'
import {
    getActiveProducts,
    getCategories,
    getHomepageSections,
    getMaxInstallments,
    getShippingSettings,
    listProducts,
    type Category,
    type HeroSlide,
    type HomeSection,
    type ListProductsParams,
    type Product,
    type ShippingSettings,
} from '@/lib/catalog'
import { categoryPath, DEFAULT_SITE_SEO, type SiteSeo } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { foldTr } from '@/lib/search'
import { formatNumberTR } from '@/lib/format'
import { imageKey } from '@/lib/images'

// ---------------------------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------------------------

/** Icon names understood by components/home/icons.tsx (product types, admin category icons, USPs). */
export type HomeIconName = string

export interface Shortcut {
    key: string
    label: string
    href: string
    count: number
    icon: HomeIconName
    /** Real category (indexable /kategori/ URL) or a product-type filter/search (listing variant). */
    kind: 'type' | 'category'
}

export interface QuickSearch {
    label: string
    href: string
    count: number
}

export interface StoreStats {
    /** Active products (in stock + sold out) = what /products/ lists. */
    productCount: number
    /** Lowest display price among in-stock products. */
    minPrice: number | null
    /** Highest discount % among in-stock products (0 when none). */
    maxDiscount: number
}

export interface HomeIntroCopy {
    /** The page H1 (one compact line at the top). */
    h1: string
    /** Real-data sentence for the "Onopo Store hakkında" text near the bottom. */
    lead: string
}

export interface TrustItem {
    key: 'shipping' | 'payment' | 'returns' | 'installments' | 'dispatch'
    title: string
    description: string
    icon: HomeIconName
}

/** A home section ready to render: admin section + resolved link for "Tümünü gör". */
export interface HomeSectionView extends HomeSection {
    href?: string
}

export interface HomeData {
    /** Active admin sections in admin order (products resolved on the server). */
    sections: HomeSectionView[]
    /** True when getHomepageSections() worked (an empty list then means "admin disabled everything"). */
    sectionsLoaded: boolean
    slides: HeroSlide[]
    shortcuts: Shortcut[]
    quickSearches: QuickSearch[]
    stats: StoreStats | null
    intro: HomeIntroCopy
    trust: TrustItem[]
    shipping: ShippingSettings
    /** Newest in-stock products, used when sections are missing or failed. */
    fallbackProducts: Product[]
    /** Names of the parts that failed to load (empty = everything loaded). */
    failed: string[]
}

// ---------------------------------------------------------------------------------------------
// Static definitions (derived from the real catalogue: see audit tasarim-referans.md §2)
// ---------------------------------------------------------------------------------------------

/**
 * Product-type shortcuts. Facet links use the lib/search FACETS keys (?f=), the same rules the
 * listing filters with, so the count shown here is exactly what the listing shows. Types that no
 * facet covers precisely use a search query (?q=).
 */
const TYPE_SHORTCUTS: Array<{ key: string; label: string; h1?: string; icon: string; facet?: string; q?: string }> = [
    { key: 'sarj-aleti', label: 'Şarj Aletleri', h1: 'Hızlı Şarj Aletleri', icon: 'plug-zap', facet: 'sarj-aleti' },
    { key: 'kablo', label: 'Kablolar', h1: 'Kablolar', icon: 'cable', facet: 'kablo' },
    { key: 'ekran-koruyucu', label: 'Ekran Koruyucular', h1: 'Ekran Koruyucular', icon: 'layers', facet: 'ekran-koruyucu' },
    { key: 'arac-sarj', label: 'Araç Şarjı', h1: 'Araç Şarj Cihazları', icon: 'car', q: 'araç şarj' },
    { key: 'powerbank', label: 'Powerbank', h1: 'Powerbankler', icon: 'battery-charging', facet: 'powerbank' },
    { key: 'kulaklik', label: 'Kulaklıklar', icon: 'headphones', facet: 'kulaklik' },
    { key: 'supurge', label: 'Süpürge ve Parçaları', icon: 'brush-cleaning', q: 'süpürge' },
]

/** Device / connector searches shown as "Cihazına göre" chips under the trust strip. */
const DEVICE_SEARCHES: Array<{ label: string; q: string }> = [
    { label: 'iPhone', q: 'iphone' },
    { label: 'Samsung', q: 'samsung' },
    { label: 'Xiaomi', q: 'xiaomi' },
    { label: 'Type-C', q: 'type-c' },
    { label: 'Lightning', q: 'lightning' },
    { label: 'Micro USB', q: 'micro usb' },
]

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

function listingHref(params: { facet?: string; q?: string }): string {
    if (params.facet) return `/products/?f=${encodeURIComponent(params.facet)}`
    return `/products/?q=${encodeURIComponent(params.q ?? '')}`
}

/** Turkish dative suffix for a number read aloud: 40 → "a" (kırk'a), 20 → "ye" (yirmi'ye), 15 → "e". */
export function dativeSuffixTr(n: number): string {
    const i = Math.abs(Math.trunc(n))
    if (i === 0) return 'a' // sıfır'a
    if (i % 1000000 === 0) return 'a' // milyon'a
    if (i % 1000 === 0) return 'e' // bin'e
    if (i % 100 === 0) return 'e' // yüz'e
    const ones: Record<number, string> = { 1: 'e', 2: 'ye', 3: 'e', 4: 'e', 5: 'e', 6: 'ya', 7: 'ye', 8: 'e', 9: 'a' }
    const tens: Record<number, string> = { 1: 'a', 2: 'ye', 3: 'a', 4: 'a', 5: 'ye', 6: 'a', 7: 'e', 8: 'e', 9: 'a' }
    if (i % 10 !== 0) return ones[i % 10]
    return tens[Math.trunc(i / 10) % 10] ?? 'a'
}

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] ?? ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

/** "500 ₺", "1.250 ₺", "79,99 ₺": whole amounts without decimals. */
export function formatAmount(n: number): string {
    return `${formatNumberTR(n, Number.isInteger(n) ? 0 : 2)} ₺`
}

/**
 * Normalises an admin link: internal paths get the trailing slash (next.config trailingSlash) so
 * there is no 308 hop; external, mailto:, tel: and #anchors are returned unchanged.
 */
export function normalizeHref(href: string | null | undefined, fallback = '/products/'): string {
    let h = (href ?? '').trim()
    if (!h) return fallback
    if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(h)) return h
    if (!h.startsWith('/')) h = `/${h.replace(/^\.\//, '')}`
    const m = h.match(/^([^?#]*)(.*)$/)
    let path = m ? m[1] : h
    const rest = m ? m[2] : ''
    // Leave file-like paths (/feed.xml) alone
    if (!path.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(path)) path = `${path}/`
    return `${path}${rest}`
}

async function settle<T>(name: string, failed: string[], fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn()
    } catch (err) {
        console.error(`[home] ${name} failed:`, err)
        failed.push(name)
        return fallback
    }
}

interface D1Stmt {
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
}
interface D1Like {
    prepare(sql: string): D1Stmt
}

const str = (v: unknown) => (v == null ? '' : String(v))
const num = (v: unknown) => {
    const n = typeof v === 'number' ? v : parseFloat(str(v))
    return Number.isFinite(n) ? n : 0
}
const bool = (v: unknown) => v === true || v === 1 || v === '1' || v === 'true'

/**
 * Active hero slides (Admin › Ana Sayfa › Hero). Same query and mapping as lib/catalog
 * getHeroSlides() / GET /api/hero, but it THROWS on a D1 error, so the page can tell "no slides"
 * from "slides failed" (and then marks the HTML as not edge-cacheable).
 */
const loadHeroSlides = cache(async (): Promise<HeroSlide[]> => {
    const d = (await getDB()) as unknown as D1Like
    const { results } = await d.prepare('SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order ASC LIMIT 5').all()
    return ((results ?? []) as Record<string, unknown>[])
        .map(r => ({
            id: num(r.id),
            title: str(r.title).trim(),
            subtitle: str(r.subtitle).trim(),
            button_text: str(r.button_text).trim(),
            button_link: str(r.button_link).trim(),
            image_url: str(r.image_url).trim(),
            display_order: num(r.display_order),
        }))
        // A slide without an image cannot be shown as a banner
        .filter(s => s.image_url)
})

/** PayTR is the active, configured provider (flags only; the keys are never selected). */
const loadPaytrActive = cache(async (): Promise<boolean> => {
    const d = (await getDB()) as unknown as D1Like
    const { results } = await d
        .prepare("SELECT provider, is_active, CASE WHEN merchant_id IS NOT NULL AND merchant_id <> '' THEN 1 ELSE 0 END AS configured FROM payment_settings")
        .all()
    return ((results ?? []) as Record<string, unknown>[]).some(
        r => str(r.provider || 'paytr').toLowerCase() === 'paytr' && bool(r.is_active) && bool(r.configured),
    )
})

async function countListing(params: ListProductsParams): Promise<number> {
    const res = await listProducts({ ...params, pageSize: 1, page: 1 })
    return res.total
}

function sectionHref(section: HomeSection, categories: Category[]): string {
    const cfg = section.config || {}
    if (cfg.selection_type === 'category' && cfg.category) {
        const want = foldTr(String(cfg.category)).trim()
        const cat = categories.find(c => foldTr(c.name).trim() === want || foldTr(c.slug).trim() === want)
        if (cat) return categoryPath(cat.slug)
    }
    return '/products/'
}

// ---------------------------------------------------------------------------------------------
// Main loader
// ---------------------------------------------------------------------------------------------

export const getHomeData = cache(async (): Promise<HomeData> => {
    const failed: string[] = []

    const [sectionsRaw, products, slides, paytrActive, categories, shipping, maxInstallments, site] = await Promise.all([
        settle<HomeSection[] | null>('sections', failed, () => getHomepageSections(), null),
        settle<Product[] | null>('products', failed, () => getActiveProducts(), null),
        settle<HeroSlide[]>('hero', failed, () => loadHeroSlides(), []),
        settle<boolean>('payment', failed, () => loadPaytrActive(), false),
        // Never throws (counts fall back to 0); a products failure is already caught above
        getCategories({ withCounts: true, hideEmpty: true }).catch(() => [] as Category[]),
        getShippingSettings(),
        getMaxInstallments().catch(() => null),
        getSiteSeo().catch(() => DEFAULT_SITE_SEO),
    ])

    const inStock = (products ?? []).filter(p => p.in_stock)

    // Shortcuts: product types (with listing counts) + real categories with products
    let shortcuts: Shortcut[] = []
    let quickSearches: QuickSearch[] = []
    if (products) {
        const typeCounts = await Promise.all(
            TYPE_SHORTCUTS.map(t => countListing(t.facet ? { facets: [t.facet] } : { q: t.q }).catch(() => 0)),
        )
        shortcuts = TYPE_SHORTCUTS.map((t, i) => ({
            key: t.key,
            label: t.label,
            href: listingHref(t),
            count: typeCounts[i],
            icon: t.icon,
            kind: 'type' as const,
        })).filter(s => s.count > 0)

        const deviceCounts = await Promise.all(DEVICE_SEARCHES.map(d => countListing({ q: d.q }).catch(() => 0)))
        quickSearches = DEVICE_SEARCHES.map((d, i) => ({ label: d.label, href: listingHref({ q: d.q }), count: deviceCounts[i] }))
            .filter(d => d.count >= 2)
    }
    const categoryShortcuts: Shortcut[] = categories
        .filter(c => c.product_count > 0)
        .sort((a, b) => b.product_count - a.product_count)
        .map(c => ({
            key: `cat-${c.id}`,
            label: c.name,
            href: categoryPath(c.slug),
            count: c.product_count,
            icon: c.icon || 'package',
            kind: 'category' as const,
        }))
    shortcuts = [...shortcuts, ...categoryShortcuts]

    // Store facts for the intro text and the promo banner
    const stats: StoreStats | null = products
        ? {
            productCount: products.length,
            minPrice: inStock.length ? Math.min(...inStock.map(p => p.display_price)) : null,
            maxDiscount: inStock.reduce((m, p) => Math.max(m, p.discount_percent), 0),
        }
        : null

    // H1 from the product types the store really sells (first three present, in our order)
    const presentTypes = TYPE_SHORTCUTS.filter(t => t.h1 && shortcuts.some(s => s.key === t.key)).map(t => t.h1 as string)
    const h1Types = presentTypes.slice(0, 3)
    const h1 = h1Types.length >= 2 ? joinTr(h1Types) : 'Telefon Aksesuarları ve Şarj Ürünleri'

    const leadParts: string[] = []
    if (stats && stats.productCount > 0) {
        let s = `${stats.productCount} ürün`
        if (stats.minPrice) s += `, ${formatAmount(stats.minPrice)}'den başlayan fiyatlar`
        if (stats.maxDiscount >= 10) s += ` ve %${stats.maxDiscount}'${dativeSuffixTr(stats.maxDiscount)} varan indirimler`
        leadParts.push(`${s}.`)
    }
    const lead = leadParts.join(' ') || 'Şarj aletleri, kablolar, ekran koruyucular ve daha fazlası Onopo Store’da.'

    // Trust strip: only facts backed by data
    const trust: TrustItem[] = []
    if (shipping.freeShippingThreshold > 0) {
        trust.push({
            key: 'shipping',
            icon: 'truck',
            title: `${formatAmount(shipping.freeShippingThreshold)} üzeri kargo bedava`,
            description: shipping.shippingCost > 0 ? `Altındaki siparişlerde kargo ${formatAmount(shipping.shippingCost)}` : 'Tüm siparişlerde kargo bedava',
        })
    } else if (shipping.shippingCost === 0) {
        trust.push({ key: 'shipping', icon: 'truck', title: 'Kargo bedava', description: 'Tüm siparişlerde' })
    }
    trust.push({
        key: 'payment',
        icon: 'shield-check',
        title: 'Güvenli ödeme',
        description: paytrActive ? 'PayTR altyapısı, 256-bit SSL' : '256-bit SSL ile şifreli ödeme',
    })
    if (site.returnPolicy) {
        trust.push({
            key: 'returns',
            icon: 'rotate-ccw',
            title: `${site.returnPolicy.days} gün kolay iade`,
            description: site.returnPolicy.freeReturn ? 'Anlaşmalı kargoyla ücretsiz iade' : 'Teslimattan itibaren',
        })
    }
    if (maxInstallments) {
        trust.push({ key: 'installments', icon: 'credit-card', title: `Kredi kartına ${maxInstallments} taksit`, description: 'Tüm kredi kartlarına' })
    } else if (site.handlingTime) {
        trust.push({ key: 'dispatch', icon: 'clock', title: `${site.handlingTime.minDays}-${site.handlingTime.maxDays} iş gününde kargoda`, description: 'Ödeme onayından sonra' })
    }

    // Sections: link targets resolved here (category listing when the section picks a category)
    const sections: HomeSectionView[] = (sectionsRaw ?? []).map(s => ({
        ...s,
        href: s.type === 'products' || s.type === 'new_products' ? sectionHref(s, categories) : undefined,
    }))

    // Newest in-stock products when sections are missing (none active) or failed
    const needFallback = !sectionsRaw || !sections.some(s => (s.type === 'products' || s.type === 'new_products') && (s.products?.length ?? 0) > 0)
    const fallbackProducts = needFallback ? inStock.slice(0, 8) : []

    return {
        sections,
        sectionsLoaded: sectionsRaw != null,
        slides,
        shortcuts,
        quickSearches,
        stats,
        intro: { h1, lead },
        trust,
        shipping,
        fallbackProducts,
        failed,
    }
})

// ---------------------------------------------------------------------------------------------
// Banner image size (Admin › Ana Sayfa › Görsel Kart): width/height for a shift-free, uncropped banner
// ---------------------------------------------------------------------------------------------

export interface ImageSize {
    width: number
    height: number
}

/** Pixel size from the first bytes of a PNG, JPEG, GIF or WebP file; null when unknown. */
export function parseImageSize(b: Uint8Array): ImageSize | null {
    const ascii = (from: number, to: number) => String.fromCharCode(...b.subarray(from, to))
    const ok = (s: ImageSize | null) => (s && s.width > 0 && s.height > 0 && s.width < 20000 && s.height < 20000 ? s : null)
    if (b.length < 30) return null
    // PNG: IHDR right after the signature
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
        const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0
        return ok({ width: u32(16), height: u32(20) })
    }
    // GIF
    if (ascii(0, 3) === 'GIF') return ok({ width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) })
    // WebP (lossy, lossless, extended)
    if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
        const chunk = ascii(12, 16)
        if (chunk === 'VP8 ') return ok({ width: (b[26] | (b[27] << 8)) & 0x3fff, height: (b[28] | (b[29] << 8)) & 0x3fff })
        if (chunk === 'VP8L') {
            const bits = (b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24)) >>> 0
            return ok({ width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 })
        }
        if (chunk === 'VP8X') return ok({ width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)), height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)) })
        return null
    }
    // JPEG: walk the markers to the first SOFn
    if (b[0] === 0xff && b[1] === 0xd8) {
        let i = 2
        while (i + 9 < b.length) {
            if (b[i] !== 0xff) {
                i++
                continue
            }
            const marker = b[i + 1]
            if (marker === 0xff) {
                i++
                continue
            }
            if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
                i += 2
                continue
            }
            const len = (b[i + 2] << 8) | b[i + 3]
            if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
                return ok({ height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] })
            }
            if (len < 2) return null
            i += 2 + len
        }
    }
    return null
}

const HEAD_BYTES = 65536

/**
 * Size of a stored banner image: data: URIs are decoded in place, R2 images are read through the
 * BUCKET binding (first 64 KB only). Never throws; null when the size cannot be found (the banner
 * then uses a fixed, uncropped box).
 */
export const getImageSize = cache(async (url: string): Promise<ImageSize | null> => {
    try {
        const u = url.trim()
        const data = /^data:image\/[a-z+.-]+;base64,/i.exec(u)
        if (data) {
            const b64 = u.slice(data[0].length, data[0].length + Math.ceil((HEAD_BYTES * 4) / 3 / 4) * 4)
            const bin = atob(b64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            return parseImageSize(bytes)
        }
        const key = imageKey(u)
        if (!key) return null
        const bucket = (await getBucket()) as unknown as {
            get(key: string, opts: { range: { offset: number; length: number } }): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>
        }
        const obj = await bucket.get(key, { range: { offset: 0, length: HEAD_BYTES } })
        if (!obj) return null
        return parseImageSize(new Uint8Array(await obj.arrayBuffer()))
    } catch (err) {
        console.error('[home] banner image size unavailable:', err)
        return null
    }
})
