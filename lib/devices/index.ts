/**
 * Device pages ("Cihaza göre", /cihaz/ and /cihaz/<slug>/): the matching rules are in ./match (also used by
 * lib/redirects.ts); this file has what the pages, the sitemap and the product page need on top: type groups,
 * titles and intros built from real counts, related guides, sitemap rows and the list of page URLs.
 * Pure, so scripts/devices.test.mjs can run it on the real catalogue names. Prices and stock never appear in a
 * text here; the cards show what checkout charges.
 */
import { guideForProduct, type Guide } from '../guides'
import { classifyProduct } from '../product-type'
import { d1DateToIso, PRODUCT_TITLE_MAX } from '../seo'
import { buildDeviceCatalog, DEVICES_PATH, devicePath, MIN_DEVICE_PRODUCTS, type DeviceBrandEntry, type DeviceCatalog, type DevicePage } from './match'

export * from './match'

export interface DeviceProduct {
    id: number
    name: string
    in_stock?: boolean
    stock?: number | null
}

function isInStock(p: DeviceProduct): boolean {
    if (typeof p.in_stock === 'boolean') return p.in_stock
    return (p.stock ?? 0) > 0
}

// ---- type groups -----------------------------------------------------------------------------------------

export type DeviceGroupKey = 'ekran-koruyucu' | 'sarj-aleti' | 'kablo' | 'arac-sarj' | 'powerbank' | 'diger'

export interface DeviceGroupDef {
    key: DeviceGroupKey
    /** H2 of the group. */
    title: string
    /** For counts in running text: "2 ekran koruyucu". */
    noun: string
    /** For <title>: "iPhone 15 Ekran Koruyucu ve Şarj Aleti". */
    titleWord: string | null
    /** lib/product-type types in this group. */
    types: string[]
}

/** Groups in page order (the model-specific screen protectors first); everything else is "Diğer ürünler". */
export const DEVICE_GROUPS: readonly DeviceGroupDef[] = [
    { key: 'ekran-koruyucu', title: 'Ekran koruyucular', noun: 'ekran koruyucu', titleWord: 'Ekran Koruyucu', types: ['Ekran Koruyucu'] },
    { key: 'sarj-aleti', title: 'Şarj aletleri', noun: 'şarj aleti', titleWord: 'Şarj Aleti', types: ['Şarj Aleti'] },
    { key: 'kablo', title: 'Kablolar', noun: 'kablo', titleWord: 'Kablo', types: ['Şarj ve Data Kablosu', 'Ses Kablosu'] },
    { key: 'arac-sarj', title: 'Araç şarj cihazları', noun: 'araç şarj cihazı', titleWord: 'Araç Şarjı', types: ['Araç Şarj Cihazı'] },
    { key: 'powerbank', title: 'Powerbankler', noun: 'powerbank', titleWord: 'Powerbank', types: ['Powerbank'] },
    { key: 'diger', title: 'Diğer ürünler', noun: 'diğer ürün', titleWord: null, types: [] },
]

const OTHER_GROUP = DEVICE_GROUPS[DEVICE_GROUPS.length - 1]

/** The group of a product, by its type (lib/product-type). */
export function deviceGroupOf(name: string): DeviceGroupDef {
    const type = classifyProduct(name)?.type
    return DEVICE_GROUPS.find(g => type && g.types.includes(type)) ?? OTHER_GROUP
}

export interface DeviceGroup<T> {
    group: DeviceGroupDef
    products: T[]
}

/** Non-empty groups in DEVICE_GROUPS order; inside a group in-stock products first, otherwise the input order. */
export function groupDeviceProducts<T extends DeviceProduct>(products: readonly T[]): DeviceGroup<T>[] {
    return DEVICE_GROUPS.map(group => {
        const list = products.filter(p => deviceGroupOf(p.name) === group)
        return { group, products: [...list.filter(isInStock), ...list.filter(p => !isInStock(p))] }
    }).filter(g => g.products.length > 0)
}

/** The page's products, in the page order (the input order of buildDeviceCatalog). */
export function devicePageProducts<T extends DeviceProduct>(page: DevicePage, products: readonly T[]): T[] {
    const byId = new Map(products.map(p => [p.id, p]))
    return page.productIds.map(id => byId.get(id)).filter((p): p is T => !!p)
}

// ---- texts ---------------------------------------------------------------------------------------------

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] ?? ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

/** H1 and breadcrumb label: "iPhone 15 aksesuarları". */
export function deviceH1(page: Pick<DevicePage, 'label'>): string {
    return `${page.label} aksesuarları`
}

/**
 * <title> without the " | Onopo" suffix, at most PRODUCT_TITLE_MAX characters: the device and the product types
 * it has ("iPhone 15 Ekran Koruyucu, Şarj Aleti ve Kablo"), fewer types when long, else "<label> Aksesuarları".
 */
export function deviceTitle(page: Pick<DevicePage, 'label'>, groups: readonly DeviceGroup<unknown>[]): string {
    const words = groups.map(g => g.group.titleWord).filter((w): w is string => !!w).slice(0, 3)
    for (let n = words.length; n > 0; n--) {
        const t = `${page.label} ${joinTr(words.slice(0, n))}`
        if (t.length <= PRODUCT_TITLE_MAX) return t
    }
    return `${page.label} Aksesuarları`
}

/**
 * Two or three sentences under the H1, from the real counts: how many products of which type, why the
 * connector products are there (model pages), where the models are (brand pages), and stock.
 */
export function deviceIntro(page: DevicePage, groups: readonly DeviceGroup<DeviceProduct>[], brand?: DeviceBrandEntry | null): string {
    const all = groups.flatMap(g => g.products)
    const total = all.length
    if (!total) return `${page.label} için şu an listelenen ürün yok.`
    const sentences = [`Onopo Store'da ${page.label} için ${total} ürün var: ${joinTr(groups.map(g => `${g.products.length} ${g.group.noun}`))}.`]
    if (page.kind === 'model' && page.connector && page.productIds.length > page.namedIds.length) {
        sentences.push(page.connector === 'usb-c'
            ? `${page.label} USB-C girişli olduğu için USB-C (Type-C) uçlu şarj aletleri ve kablolar da listede.`
            : `${page.label} Lightning girişli olduğu için Lightning uçlu şarj aletleri ve kablolar da listede.`)
    }
    if (page.kind === 'brand' && brand) {
        const withPage = brand.models.filter(m => m.hasPage)
        if (withPage.length) {
            sentences.push(`Modelinize uyan ürünleri görmek için aşağıdan modelinizi seçin.`)
        } else if (brand.models.length) {
            const names = brand.models.map(m => m.label)
            const shown = names.length > 5 ? [...names.slice(0, 5), `${names.length - 5} model daha`] : names
            sentences.push(`Adında model geçen ürünler: ${joinTr(shown)}.`)
        }
    }
    const inStock = all.filter(isInStock).length
    if (inStock === 0) sentences.push('Bu ürünlerin hepsi şu an tükendi.')
    else if (inStock < total) sentences.push('Stokta olmayanlar her grubun sonunda.')
    return sentences.join(' ')
}

/** Hub texts. */
export const DEVICES_HUB = {
    h1: 'Cihaza göre aksesuarlar',
    title: 'Cihaza Göre Telefon ve Tablet Aksesuarları',
    /** Breadcrumb label of the hub. */
    crumb: 'Cihazlar',
} as const

// ---- links ---------------------------------------------------------------------------------------------

/** Guides that fit most of the page's products (guideForProduct), at most `limit`, most products first. */
export function relatedDeviceGuides(products: readonly { name: string }[], limit = 3): Guide[] {
    const counts = new Map<Guide, number>()
    for (const p of products) {
        const g = guideForProduct(p)
        if (g) counts.set(g, (counts.get(g) ?? 0) + 1)
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([g]) => g)
}

/** The other model pages of the same brand (sibling links), in the brand's model order. */
export function siblingDevicePages(catalog: DeviceCatalog, page: DevicePage): DevicePage[] {
    return catalog.pages.filter(p => p.kind === 'model' && p.brand === page.brand && p.slug !== page.slug)
}

/** The brand entry of a page (models list, brand page). */
export function deviceBrandOf(catalog: DeviceCatalog, page: Pick<DevicePage, 'brand'>): DeviceBrandEntry | null {
    return catalog.brands.find(b => b.id === page.brand) ?? null
}

// ---- indexing: page URLs and sitemap ---------------------------------------------------------------------

/**
 * Whether a page is indexable (otherwise it answers 200 with noindex and stays out of the sitemap, llms.txt and
 * IndexNow): at least one in-stock product, and on a model page at least MIN_DEVICE_PRODUCTS products whose name
 * names the model. A model page filled mostly by the connector rule is the same list on every model with that
 * port ("iPhone 15" … "iPhone 16 Pro Max" differ by two screen protectors): useful from the product page, but
 * near-duplicates for a search engine.
 */
export function isIndexableDevicePage(page: DevicePage, products: readonly DeviceProduct[]): boolean {
    if (page.kind === 'model' && page.namedIds.length < MIN_DEVICE_PRODUCTS) return false
    const ids = new Set(page.productIds)
    return products.some(p => ids.has(p.id) && isInStock(p))
}

/** The indexable pages in catalogue order (per brand: the brand page, then its model pages). */
export function indexableDevicePages(products: readonly DeviceProduct[], catalog: DeviceCatalog = buildDeviceCatalog(products)): DevicePage[] {
    return catalog.pages.filter(p => isIndexableDevicePage(p, products))
}

/**
 * Paths of the indexable device pages (the hub first, then every indexable brand and model page) for ACTIVE
 * products: the sitemap (and through it IndexNow's daily sweep) and llms.txt. Empty when there is none.
 */
export function devicePagePaths(products: readonly DeviceProduct[], catalog: DeviceCatalog = buildDeviceCatalog(products)): string[] {
    const pages = indexableDevicePages(products, catalog)
    return pages.length ? [DEVICES_PATH, ...pages.map(p => devicePath(p.slug))] : []
}

/**
 * The llms.txt section links (app/llms.txt/route.ts): the hub, then every indexable page with its product count
 * ("36 ürün"). Same pages as the sitemap. Empty when there is none.
 */
export function deviceLlmsLinks(products: readonly DeviceProduct[], catalog: DeviceCatalog = buildDeviceCatalog(products)): Array<{ label: string; path: string; note: string }> {
    const pages = indexableDevicePages(products, catalog)
    if (!pages.length) return []
    const total = new Set(pages.flatMap(p => p.productIds)).size
    return [
        { label: DEVICES_HUB.h1, path: DEVICES_PATH, note: `${pages.length} cihaz sayfası, ${total} ürün` },
        ...pages.map(p => ({ label: deviceH1(p), path: devicePath(p.slug), note: `${p.productIds.length} ürün` })),
    ]
}

export interface DeviceSitemapProduct extends DeviceProduct {
    updated_at?: string | null
    created_at?: string | null
}

/** Sitemap rows: devicePagePaths with lastmod = the newest change of a product on the page (the hub: of all). */
export function deviceSitemapEntries(products: readonly DeviceSitemapProduct[]): Array<{ path: string; lastModified?: string }> {
    const catalog = buildDeviceCatalog(products)
    const changed = new Map(products.map(p => [p.id, p.updated_at || p.created_at || null]))
    const newest = (ids: readonly number[]): string | undefined => {
        let best: string | null = null
        for (const id of ids) {
            const d = changed.get(id)
            if (d && (!best || d > best)) best = d
        }
        return d1DateToIso(best) ?? undefined
    }
    const pages = indexableDevicePages(products, catalog)
    if (!pages.length) return []
    const row = (path: string, ids: readonly number[]) => {
        const lastModified = newest(ids)
        return lastModified ? { path, lastModified } : { path }
    }
    return [row(DEVICES_PATH, pages.flatMap(p => p.productIds)), ...pages.map(p => row(devicePath(p.slug), p.productIds))]
}
