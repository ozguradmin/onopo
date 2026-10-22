/**
 * Home page campaign banners ("Kampanyalar" slider at the top of app/page.tsx), built from real store
 * data on every request: the largest real discount, a screen-protector line that really has one price,
 * the free-shipping threshold and the strongest charger. A banner whose fact is not true right now is
 * left out, so the text never claims a discount, price or offer the store does not have.
 *
 * ISOMORPHIC and pure (no server imports): scripts/campaigns.test.mjs runs it with plain objects.
 */
import { dativeSuffixTr, formatAmount } from './format'
import { matchesFacet, normalizeText, wattOf } from './search'

export type CampaignKey = 'firsatlar' | 'ekran-koruyucu' | 'turbo-sarj' | 'kargo-bedava'

/** Colour scheme of the banner: its artwork and the text colour on it (light text on sale/turbo). */
export type CampaignTheme = 'sale' | 'glass' | 'turbo' | 'shipping'

export interface Campaign {
    key: CampaignKey
    theme: CampaignTheme
    kicker: string
    title: string
    subtitle: string
    cta: string
    href: string
    /** Stored product image references for the built-in artwork (used until a campaign photo exists). */
    productImages: string[]
    /** Campaign photo (public/kampanya/), when one has been added to CAMPAIGN_PHOTOS. */
    photo: CampaignPhoto | null
}

export interface CampaignPhoto {
    /** 16:9 WebP files /kampanya/<name>-800.webp and /kampanya/<name>-1600.webp. */
    name: string
    /** Horizontal focal point for the 2:1 crop (CSS object-position x, e.g. '70%'). */
    focusX?: string
    /**
     * The words printed in the photo (headline, button), when the photo carries its own text. The
     * banner then draws no text of its own and uses this as the link's accessible name.
     */
    text?: string
    /** What the printed text claims: the photo is shown only while the live data still says so. */
    claims?: CampaignClaims
    /**
     * The same photo without text (files /kampanya/<plain>-800.webp / -1600.webp). Shown with the live
     * text on top when a claim is no longer true, so the banner keeps its photo either way.
     */
    plain?: string
}

export interface CampaignClaims {
    /** "%41'e varan indirim": the largest live discount must still be at least this. */
    minMaxDiscount?: number
    /** "129,99 TL": the screen-protector line must still have exactly this one price. */
    onePrice?: number
    /** "500 TL üzeri": the free-shipping threshold must still be exactly this. */
    freeShippingThreshold?: number
    /** "120W'a kadar": an in-stock charger of at least this wattage must still exist. */
    minTopWatt?: number
    /** "18:00'e kadar": the admin delivery line must still mention this. */
    dispatchMentions?: string
}

/** Live facts a campaign is built from, checked against a photo's claims. */
interface CampaignFacts {
    maxDiscount?: number
    onePrice?: number | null
    freeShippingThreshold?: number
    topWatt?: number
    dispatchText?: string
}

type PhotoMap = Partial<Record<CampaignKey, CampaignPhoto>>

/**
 * Photos made for the banners (Gemini, from the prompts in the banner package; the owner's text is printed
 * in them, so each lists what that text claims). Add an entry when the
 * files are in public/kampanya/; until then the banner shows its built-in artwork (theme colours and
 * the product photos below).
 */
export const CAMPAIGN_PHOTOS: PhotoMap = {
    firsatlar: {
        name: 'firsatlar',
        plain: 'firsatlar-yazisiz',
        text: "Fırsatlar: %41'e varan indirim, şarj aleti, kablo ve ekran koruyucuda. İndirimleri gör",
        claims: { minMaxDiscount: 41 },
    },
    'ekran-koruyucu': {
        name: 'ekran-koruyucu',
        plain: 'ekran-koruyucu-yazisiz',
        text: 'Tek fiyat: 9D cam ekran koruyucu 129,99 TL. Modelini bul',
        claims: { onePrice: 129.99 },
    },
    'turbo-sarj': {
        name: 'turbo-sarj',
        plain: 'turbo-sarj-yazisiz',
        text: "Turbo şarj: 120W'a kadar hızlı şarj, GaN teknolojili 67W ve 120W setler. Şarj aletlerini gör",
        claims: { minTopWatt: 120 },
    },
    'kargo-bedava': {
        name: 'kargo-bedava',
        plain: 'kargo-bedava-yazisiz',
        text: "Kargo: 500 TL üzeri kargo bedava, 18:00'e kadar aynı gün kargoda. Alışverişe başla",
        claims: { freeShippingThreshold: 500, dispatchMentions: '18:00' },
    },
}

function claimsHold(c: CampaignClaims, facts: CampaignFacts): boolean {
    if (c.minMaxDiscount != null && !((facts.maxDiscount ?? 0) >= c.minMaxDiscount)) return false
    if (c.onePrice != null && facts.onePrice !== c.onePrice) return false
    if (c.freeShippingThreshold != null && facts.freeShippingThreshold !== c.freeShippingThreshold) return false
    if (c.minTopWatt != null && !((facts.topWatt ?? 0) >= c.minTopWatt)) return false
    if (c.dispatchMentions && !(facts.dispatchText ?? '').includes(c.dispatchMentions)) return false
    return true
}

/**
 * The campaign's photo. When the text printed in it is no longer true: its text-free twin (the banner
 * then draws the live text itself), else no photo (built-in artwork with the live text).
 */
function photoFor(photos: PhotoMap, key: CampaignKey, facts: CampaignFacts): CampaignPhoto | null {
    const photo = photos[key]
    if (!photo) return null
    if (!photo.claims || claimsHold(photo.claims, facts)) return photo
    return photo.plain ? { name: photo.plain, focusX: photo.focusX } : null
}

/** The product fields the campaigns read (a lib/catalog Product works as is). */
export interface CampaignProduct {
    name: string
    display_price: number
    discount_percent: number
    in_stock: boolean
    images: string[]
}

export interface CampaignInput {
    /** Active products (lib/catalog getActiveProducts). */
    products: CampaignProduct[]
    freeShippingThreshold: number
    /** Admin "Neden Onopo?" delivery line, e.g. "Saat 18:00'ya kadar aynı gün kargo" (null when there is none). */
    dispatchText?: string | null
    maxInstallments?: number | null
    /** Products to show on the free-shipping banner (the first home product row). */
    spotlight?: CampaignProduct[]
    /** Campaign photos (default CAMPAIGN_PHOTOS; tests pass their own). */
    photos?: PhotoMap
}

/** A discount banner needs a real discount of at least this much on at least MIN_SALE_PRODUCTS products. */
const MIN_SALE_PERCENT = 10
const MIN_SALE_PRODUCTS = 3
/** "Tek fiyat" only for a line of at least this many products that all cost the same. */
const MIN_ONE_PRICE_LINE = 5

const withImage = (p: CampaignProduct) => p.images.length > 0

function firstImages(list: CampaignProduct[], n: number): string[] {
    return list.filter(withImage).slice(0, n).map(p => p.images[0])
}

/** "%41'e varan indirim" etc. */
function upTo(pct: number): string {
    return `%${pct}'${dativeSuffixTr(pct)} varan indirim`
}

function saleCampaign(inStock: CampaignProduct[], photos: PhotoMap): Campaign | null {
    const sale = inStock.filter(p => p.discount_percent >= MIN_SALE_PERCENT).sort((a, b) => b.discount_percent - a.discount_percent)
    if (sale.length < MIN_SALE_PRODUCTS) return null
    return {
        key: 'firsatlar',
        theme: 'sale',
        kicker: 'Fırsatlar',
        title: upTo(sale[0].discount_percent),
        subtitle: `${sale.length} üründe indirim`,
        cta: 'İndirimleri gör',
        href: '/products/?sort=discount',
        productImages: firstImages(sale, 3),
        photo: photoFor(photos, 'firsatlar', { maxDiscount: sale[0].discount_percent }),
    }
}

/** The single price of a product line, or null when the line is too small or its prices differ. */
function onePrice(line: CampaignProduct[]): number | null {
    if (line.length < MIN_ONE_PRICE_LINE) return null
    const price = line[0].display_price
    return price > 0 && line.every(p => p.display_price === price) ? price : null
}

const minPrice = (list: CampaignProduct[]) => Math.min(...list.map(p => p.display_price))

function screenProtectorCampaign(inStock: CampaignProduct[], photos: PhotoMap): Campaign | null {
    const all = inStock.filter(p => matchesFacet(p.name, 'ekran-koruyucu') || /\bseramik\b/.test(normalizeText(p.name)))
    if (all.length < MIN_ONE_PRICE_LINE) return null
    const glass = all.filter(p => /\b9d\b/.test(normalizeText(p.name)))
    const ceramic = all.filter(p => /\bseramik\b/.test(normalizeText(p.name)))
    const glassPrice = onePrice(glass)
    const ceramicPrice = onePrice(ceramic)
    const base = {
        key: 'ekran-koruyucu' as const,
        theme: 'glass' as const,
        cta: 'Modelini bul',
        href: '/products/?f=ekran-koruyucu',
        productImages: [...firstImages(glass, 1), ...firstImages(ceramic, 1)].concat(firstImages(all, 2)).filter((v, i, a) => a.indexOf(v) === i).slice(0, 2),
        // The photo shows the 9D line's single price (its claims carry onePrice)
        photo: photoFor(photos, 'ekran-koruyucu', { onePrice: glassPrice }),
    }
    if (glassPrice != null) {
        return {
            ...base,
            kicker: 'Tek fiyat',
            title: `9D cam ekran koruyucu ${formatAmount(glassPrice)}`,
            subtitle: ceramic.length ? `${glass.length} telefon modeli · Seramik ${formatAmount(minPrice(ceramic))}'den` : `${glass.length} telefon modeli`,
        }
    }
    if (ceramicPrice != null) {
        return {
            ...base,
            kicker: 'Tek fiyat',
            title: `Seramik ekran koruyucu ${formatAmount(ceramicPrice)}`,
            subtitle: `${ceramic.length} telefon modeli`,
        }
    }
    return {
        ...base,
        kicker: 'Ekran koruyucu',
        title: `Ekran koruyucular ${formatAmount(minPrice(all))}'den`,
        subtitle: `${all.length} telefon modeli`,
    }
}

function chargerCampaign(inStock: CampaignProduct[], photos: PhotoMap): Campaign | null {
    const chargers = inStock
        .filter(p => matchesFacet(p.name, 'sarj-aleti'))
        .map(p => ({ p, w: wattOf(normalizeText(p.name)) }))
        .filter(c => c.w > 0)
        .sort((a, b) => b.w - a.w)
    if (!chargers.length || chargers[0].w < 30) return null
    const top = chargers[0].w
    return {
        key: 'turbo-sarj',
        theme: 'turbo',
        kicker: 'Turbo şarj',
        // Watt is read "vat": 120W'a, 67W'a
        title: `${top}W'a kadar hızlı şarj`,
        subtitle: `Şarj aletleri ${formatAmount(minPrice(chargers.map(c => c.p)))}'den`,
        cta: 'Şarj aletlerini gör',
        href: '/products/?f=sarj-aleti',
        productImages: firstImages(chargers.map(c => c.p), 2),
        photo: photoFor(photos, 'turbo-sarj', { topWatt: top }),
    }
}

function shippingCampaign(input: CampaignInput, inStock: CampaignProduct[], photos: PhotoMap): Campaign | null {
    if (!(input.freeShippingThreshold > 0)) return null
    const dispatch = (input.dispatchText ?? '').trim()
    const subtitle = dispatch || (input.maxInstallments ? `Kredi kartına ${input.maxInstallments} taksit` : '')
    const spot = (input.spotlight ?? []).filter(p => p.in_stock)
    return {
        key: 'kargo-bedava',
        theme: 'shipping',
        kicker: 'Kargo',
        title: `${formatAmount(input.freeShippingThreshold)} üzeri kargo bedava`,
        subtitle,
        cta: 'Alışverişe başla',
        href: '/products/',
        productImages: firstImages(spot.length >= 2 ? spot : inStock, 3),
        photo: photoFor(photos, 'kargo-bedava', { freeShippingThreshold: input.freeShippingThreshold, dispatchText: dispatch }),
    }
}

/** The campaign banners that are true right now, in slider order. */
export function buildCampaigns(input: CampaignInput): Campaign[] {
    const inStock = input.products.filter(p => p.in_stock && p.display_price > 0)
    const photos = input.photos ?? CAMPAIGN_PHOTOS
    return [saleCampaign(inStock, photos), screenProtectorCampaign(inStock, photos), chargerCampaign(inStock, photos), shippingCampaign(input, inStock, photos)].filter(
        (c): c is Campaign => c != null,
    )
}
