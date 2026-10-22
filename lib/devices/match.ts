/**
 * Device pages (/cihaz/ and /cihaz/<slug>/): which phones and tablets the catalogue has products for, and which
 * products belong to each, read from the product NAMES only. Pure and lean on purpose: lib/redirects.ts (bundled
 * into worker.ts) uses it to know the live /cihaz/ URLs. Tests: scripts/devices.test.mjs, on the real names.
 *
 * Rules (when unsure, a product is left out):
 * - A product names a model when the brand or series word is followed by the model ("iPhone 15 Pro",
 *   "Redmi Note 12S", "Galaxy Tab S6 Lite"). The words after it must not make it another model, so "iPhone 15"
 *   is never "iPhone 15 Pro" and "Redmi Note 12" is never "Redmi Note 12 Pro" or "12S". A list names every model
 *   in it: "iPhone 13 / 13 Pro", "iPad Air 5 / 6", "Mi 13T / Mi 13T Pro". Screen sizes ("10.4 İnç", "7''") and
 *   other numbers with a unit are never model numbers.
 * - A product belongs to a brand when its name has the brand word ("Android Xiaomi ve Samsung Uyumlu …" belongs to
 *   both), or a connector that only that brand uses (Lightning: iPhone). Samsung tablets (Tab, SM-T/SM-P codes)
 *   are a brand page of their own.
 * - Connector rules, only where the port is certain: iPhone up to 14 (and SE, X, XR, XS) has Lightning, iPhone 15
 *   and later USB-C, Galaxy S8 and later USB-C. A charger, cable or car charger whose name has that connector (and
 *   not another phone connector) is listed for those models. Android brands as a whole get no connector rule:
 *   their phones mix Micro USB and USB-C.
 * - A page exists when at least MIN_DEVICE_PRODUCTS active products belong to it (no thin pages); a smaller model
 *   is only listed on its brand page.
 */
import { classifyProduct } from '../product-type'
import { foldTr } from '../seo'

export type DeviceBrandId = 'iphone' | 'samsung' | 'xiaomi-redmi' | 'infinix' | 'ipad' | 'samsung-tablet' | 'huawei'
export type DeviceConnector = 'lightning' | 'usb-c'

export interface DeviceBrandDef {
    id: DeviceBrandId
    /** As in "<label> aksesuarları". */
    label: string
}

/** Brands in hub order (phones first). The slug of a brand page is its id. */
export const DEVICE_BRANDS: readonly DeviceBrandDef[] = [
    { id: 'iphone', label: 'iPhone' },
    { id: 'samsung', label: 'Samsung' },
    { id: 'xiaomi-redmi', label: 'Xiaomi ve Redmi' },
    { id: 'infinix', label: 'Infinix' },
    { id: 'ipad', label: 'iPad' },
    { id: 'samsung-tablet', label: 'Samsung Galaxy Tab' },
    { id: 'huawei', label: 'Huawei' },
]

/** A page needs at least this many active products. */
export const MIN_DEVICE_PRODUCTS = 3

/** The hub. */
export const DEVICES_PATH = '/cihaz/'

/** Canonical path of a device page: /cihaz/<slug>/ (trailing slash, like every storefront URL). */
export function devicePath(slug: string): string {
    return `${DEVICES_PATH}${slug}/`
}

// ---- reading names -------------------------------------------------------------------------------------

/** Words that start a device name, and the brand they belong to. */
const BRAND_WORDS: Readonly<Record<string, DeviceBrandId>> = {
    iphone: 'iphone',
    ipad: 'ipad',
    samsung: 'samsung',
    galaxy: 'samsung',
    xiaomi: 'xiaomi-redmi',
    redmi: 'xiaomi-redmi',
    poco: 'xiaomi-redmi',
    huawei: 'huawei',
    mediapad: 'huawei',
    matepad: 'huawei',
    infinix: 'infinix',
}

/** Series words that are part of the model name, per brand ("Redmi Note 12", "Galaxy Tab S7", "iPad Air 5"). */
const SERIES: Readonly<Partial<Record<DeviceBrandId, Readonly<Record<string, string>>>>> = {
    samsung: { tab: 'Tab', note: 'Note' },
    'xiaomi-redmi': { redmi: 'Redmi', note: 'Note', mi: 'Mi', poco: 'Poco' },
    huawei: { mediapad: 'MediaPad', matepad: 'MatePad', mate: 'Mate', nova: 'Nova' },
    ipad: { air: 'Air', pro: 'Pro', mini: 'Mini' },
    infinix: { note: 'Note', hot: 'Hot', zero: 'Zero', smart: 'Smart' },
}

/** Words after the model number that make it another model ("Pro", "Pro Max", "Plus", "Lite" …). */
const MODIFIERS: Readonly<Record<string, string>> = {
    pro: 'Pro', max: 'Max', plus: 'Plus', ultra: 'Ultra', lite: 'Lite', mini: 'Mini', fe: 'FE', '5g': '5G',
}

const IPHONE_LETTER_MODELS: Readonly<Record<string, string>> = { se: 'SE', x: 'X', xr: 'XR', xs: 'XS' }

/** "20w", "12d" (glass), "1m", "30cm": a number with a unit, never a model. */
const UNIT_NUMBER = /^\d+(?:w|m|mm|cm|mt|v|d|k|gb|tb|hz|mp|mah)$/

/** Model number as shown ("15", "S24", "10A", "12S", "13T", "S5e", "T870"), or null. */
function modelNumber(brand: DeviceBrandId, word: string | undefined): string | null {
    if (!word) return null
    if (brand === 'iphone') {
        if (IPHONE_LETTER_MODELS[word]) return IPHONE_LETTER_MODELS[word]
        const m = /^(\d{1,2})(e?)$/.exec(word)
        return m && Number(m[1]) >= 3 && Number(m[1]) <= 30 ? `${m[1]}${m[2]}` : null
    }
    if (!/^[a-z]{0,2}\d{1,4}[a-z]{0,2}$/.test(word) || UNIT_NUMBER.test(word)) return null
    if (/^\d+$/.test(word) && Number(word) > 99) return null
    // "s5e" → "S5e", "10a" → "10A", "13t" → "13T"
    return word.toUpperCase().replace(/^(S\d+)E$/, '$1e')
}

/** Folded words of a name; sizes and decimals removed, "/" kept as a word (model lists). */
export function deviceWords(name: string): string[] {
    return foldTr(String(name ?? ''))
        .replace(/\+/g, ' plus ')
        .replace(/\d+(?:[.,]\d+)?\s*(?:''|"|”|″|inc\b|inch\w*)/g, ' ')
        .replace(/\d+[.,]\d+[a-z]*/g, ' ')
        .replace(/\//g, ' / ')
        .replace(/[^a-z0-9/]+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
}

function slugOf(text: string): string {
    return foldTr(text).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** A model a product name names. */
export interface NamedModel {
    brand: DeviceBrandId
    /** URL slug and identity: "iphone-15-pro", "samsung-galaxy-s24-ultra", "redmi-note-12s". */
    slug: string
    /** "iPhone 15 Pro", "Galaxy S24 Ultra", "Redmi Note 12S", "Galaxy Tab S6 Lite". */
    label: string
}

const SLUG_PREFIX: Readonly<Record<DeviceBrandId, RegExp | null>> = {
    iphone: null,
    ipad: null,
    infinix: null,
    samsung: /^samsung-/,
    'samsung-tablet': /^samsung-/,
    'xiaomi-redmi': /^(xiaomi|redmi|poco)-/,
    huawei: /^huawei-/,
}
const SLUG_BRAND_WORD: Readonly<Record<DeviceBrandId, string>> = {
    iphone: 'iphone', ipad: 'ipad', infinix: 'infinix', samsung: 'samsung', 'samsung-tablet': 'samsung', 'xiaomi-redmi': 'xiaomi', huawei: 'huawei',
}

function makeModel(brand: DeviceBrandId, series: string[], parts: string[], galaxy: boolean): NamedModel {
    let words: string[]
    if (brand === 'iphone') words = ['iPhone', ...parts]
    else if (brand === 'ipad') words = ['iPad', ...series, ...parts]
    else if (brand === 'infinix') words = ['Infinix', ...series, ...parts]
    else if (brand === 'samsung' || brand === 'samsung-tablet') {
        // "Samsung S24" is the Galaxy S24; a bare tablet code keeps the name's words ("Samsung T515")
        words = galaxy || brand === 'samsung' ? ['Galaxy', ...series, ...parts] : ['Samsung', ...series, ...parts]
    } else if (brand === 'xiaomi-redmi') {
        // "Xiaomi Redmi Mi 13T" is the Mi 13T: the Mi line is not a Redmi
        const s = series.includes('Mi') ? series.filter(w => w !== 'Redmi') : series
        words = s.length ? [...s, ...parts] : ['Xiaomi', ...parts]
    } else {
        words = series.length ? [...series, ...parts] : ['Huawei', ...parts]
    }
    const label = words.join(' ')
    let slug = slugOf(label)
    const prefix = SLUG_PREFIX[brand]
    if (prefix && !prefix.test(`${slug}-`)) slug = `${SLUG_BRAND_WORD[brand]}-${slug}`
    return { brand, slug, label }
}

interface NameScan {
    models: NamedModel[]
    brands: Set<DeviceBrandId>
}

/** Every brand word of a name and the models that follow it. */
function scanName(name: string): NameScan {
    const words = deviceWords(name)
    const models: NamedModel[] = []
    const brands = new Set<DeviceBrandId>()
    for (let i = 0; i < words.length; i++) {
        let brand = BRAND_WORDS[words[i]]
        if (!brand) continue
        const seriesWords = SERIES[brand] ?? {}
        const series: string[] = []
        let galaxy = words[i] === 'galaxy'
        if (seriesWords[words[i]]) series.push(seriesWords[words[i]])
        let j = i + 1
        // "Samsung Galaxy Tab", "Xiaomi Redmi Note": more brand and series words of the same brand
        for (; j < words.length; j++) {
            const w = words[j]
            if (seriesWords[w]) series.push(seriesWords[w])
            else if (BRAND_WORDS[w] === brand) galaxy ||= w === 'galaxy'
            else break
        }
        const core = (k: number): { parts: string[]; next: number } | null => {
            const num = modelNumber(brand!, words[k])
            const parts: string[] = num ? [num] : []
            let n = num ? k + 1 : k
            while (n < words.length && MODIFIERS[words[n]]) parts.push(MODIFIERS[words[n++]])
            if (num) return { parts, next: n }
            // No number: only an iPad or Huawei tablet line with a second word ("iPad Air", "MatePad Pro")
            const allowed = (brand === 'ipad' && series.length + parts.length >= 1) || (brand === 'huawei' && series.length >= 1 && parts.length >= 1)
            return allowed && k === j ? { parts, next: n } : null
        }
        const first = core(j)
        if (brand === 'samsung') {
            // Samsung tablets: "Galaxy Tab …", or an SM-T/SM-P model code ("Samsung T515")
            const tabletCode = first && /^[TP]\d{3}$/.test(first.parts[0] ?? '')
            if (series.includes('Tab') || tabletCode) brand = 'samsung-tablet'
        }
        brands.add(brand)
        if (!first) continue
        models.push(makeModel(brand, series, first.parts, galaxy))
        j = first.next
        // "13 / 13 Pro", "Air 5 / 6", "Mi 13T / Mi 13T Pro": the list goes on with the same brand
        while (words[j] === '/') {
            let k = j + 1
            const restart: string[] = []
            while (k < words.length && seriesWords[words[k]]) restart.push(seriesWords[words[k++]])
            const num = modelNumber(brand, words[k])
            if (!num) break
            const parts = [num]
            k++
            while (k < words.length && MODIFIERS[words[k]]) parts.push(MODIFIERS[words[k++]])
            models.push(makeModel(brand, restart.length ? restart : series, parts, galaxy))
            j = k
        }
        i = j - 1
    }
    const seen = new Set<string>()
    return { models: models.filter(m => (seen.has(m.slug) ? false : (seen.add(m.slug), true))), brands }
}

/** The models a product name names ("iPhone 13 / 13 Pro" → iPhone 13 and iPhone 13 Pro). */
export function modelsInName(name: string): NamedModel[] {
    return scanName(name).models
}

/** The brands a product name names (brand words only, no connector rule). */
export function brandsInName(name: string): DeviceBrandId[] {
    return [...scanName(name).brands]
}

// ---- connectors ----------------------------------------------------------------------------------------

/** The phone-side connector a name has: Lightning wins ("Type-C to Lightning"), then Micro USB, then USB-C. */
export function productConnector(name: string): DeviceConnector | 'micro-usb' | null {
    const n = ` ${foldTr(String(name ?? '')).replace(/[^a-z0-9]+/g, ' ')} `
    if (/ lightning /.test(n)) return 'lightning'
    if (/ micro /.test(n)) return 'micro-usb'
    if (/ (?:type ?c|usb ?c|typec) /.test(n)) return 'usb-c'
    return null
}

/** Product types a connector rule may add: chargers, cables and car chargers (lib/product-type). */
const CONNECTOR_TYPES = new Set(['Şarj Aleti', 'Şarj ve Data Kablosu', 'Araç Şarj Cihazı'])

export function isConnectorProduct(name: string): boolean {
    return CONNECTOR_TYPES.has(classifyProduct(name)?.type ?? '')
}

/** The port of a model, where it is certain; null otherwise (then only products naming the model are listed). */
export function modelConnector(model: Pick<NamedModel, 'brand' | 'slug'>): DeviceConnector | null {
    if (model.brand === 'iphone') {
        const m = /^iphone-(\d+)/.exec(model.slug)
        if (!m) return /^iphone-(se|x|xr|xs)(-|$)/.test(model.slug) ? 'lightning' : null
        const n = Number(m[1])
        return n >= 15 ? 'usb-c' : n >= 5 ? 'lightning' : null
    }
    if (model.brand === 'samsung') {
        const m = /^samsung-galaxy-s(\d+)(-|$)/.exec(model.slug)
        return m && Number(m[1]) >= 8 ? 'usb-c' : null
    }
    return null
}

/** Brand-wide connector rules: a connector only this brand's devices use. */
const BRAND_CONNECTOR: Readonly<Partial<Record<DeviceBrandId, DeviceConnector>>> = { iphone: 'lightning' }

// ---- the catalogue ---------------------------------------------------------------------------------------

export interface DeviceProductLike {
    id: number
    name: string
}

export interface DeviceModelEntry extends NamedModel {
    connector: DeviceConnector | null
    /** Products whose name names the model. */
    namedIds: number[]
    /** namedIds plus the connector rule's products, in the input order. */
    productIds: number[]
    hasPage: boolean
}

export interface DeviceBrandEntry extends DeviceBrandDef {
    slug: string
    productIds: number[]
    hasPage: boolean
    /** Models named in the catalogue, natural order ("iPhone 11", "iPhone 11 Pro", "iPhone 13" …). */
    models: DeviceModelEntry[]
}

export interface DevicePage {
    kind: 'brand' | 'model'
    slug: string
    brand: DeviceBrandId
    /** "iPhone 15", "Samsung", "Xiaomi ve Redmi". */
    label: string
    connector: DeviceConnector | null
    productIds: number[]
    /** Model pages: products naming the model (the rest came from the connector rule). */
    namedIds: number[]
}

export interface DeviceCatalog {
    /** Brands with at least one product, in DEVICE_BRANDS order. */
    brands: DeviceBrandEntry[]
    /** Every page: per brand the brand page, then its model pages. */
    pages: DevicePage[]
    bySlug: Map<string, DevicePage>
}

const byLabel = new Intl.Collator('tr', { numeric: true, sensitivity: 'base' })

/**
 * Device pages for a list of ACTIVE products (any order; the page lists keep it). Pages with fewer than
 * MIN_DEVICE_PRODUCTS products are left out; their models stay in `brands` with hasPage false.
 */
export function buildDeviceCatalog(products: readonly DeviceProductLike[]): DeviceCatalog {
    const brandIds = new Map<DeviceBrandId, number[]>()
    const models = new Map<string, DeviceModelEntry>()
    const connectorProducts: Array<{ id: number; connector: DeviceConnector }> = []
    for (const p of products) {
        const name = String(p.name ?? '')
        const scan = scanName(name)
        const connector = productConnector(name)
        const fits = (connector === 'lightning' || connector === 'usb-c') && isConnectorProduct(name) ? connector : null
        if (fits) connectorProducts.push({ id: p.id, connector: fits })
        const brands = new Set(scan.brands)
        for (const [brand, c] of Object.entries(BRAND_CONNECTOR)) if (fits && fits === c) brands.add(brand as DeviceBrandId)
        for (const b of brands) brandIds.set(b, [...(brandIds.get(b) ?? []), p.id])
        for (const m of scan.models) {
            const entry = models.get(m.slug) ?? { ...m, connector: modelConnector(m), namedIds: [], productIds: [], hasPage: false }
            entry.namedIds.push(p.id)
            models.set(m.slug, entry)
        }
    }
    const order = new Map(products.map((p, i) => [p.id, i]))
    for (const m of models.values()) {
        const ids = new Set(m.namedIds)
        if (m.connector) for (const c of connectorProducts) if (c.connector === m.connector) ids.add(c.id)
        m.productIds = [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
        m.hasPage = m.productIds.length >= MIN_DEVICE_PRODUCTS
    }

    const brands: DeviceBrandEntry[] = []
    const pages: DevicePage[] = []
    for (const def of DEVICE_BRANDS) {
        const productIds = brandIds.get(def.id) ?? []
        const own = [...models.values()].filter(m => m.brand === def.id).sort((a, b) => byLabel.compare(a.label, b.label))
        if (!productIds.length && !own.length) continue
        const entry: DeviceBrandEntry = { ...def, slug: def.id, productIds, hasPage: productIds.length >= MIN_DEVICE_PRODUCTS, models: own }
        brands.push(entry)
        if (entry.hasPage) pages.push({ kind: 'brand', slug: entry.slug, brand: def.id, label: def.label, connector: null, productIds, namedIds: productIds })
        for (const m of own) {
            if (m.hasPage) pages.push({ kind: 'model', slug: m.slug, brand: m.brand, label: m.label, connector: m.connector, productIds: m.productIds, namedIds: m.namedIds })
        }
    }
    return { brands, pages, bySlug: new Map(pages.map(p => [p.slug, p])) }
}

/**
 * The one device page a product page links to ("Bu cihaz için diğer ürünler"): the model page when the name
 * names exactly one model that has a page, else the brand page when it names exactly one brand that has one.
 * Connector rules do not count here (a USB-C cable fits too many devices to pick one).
 */
export function devicePageForProduct(catalog: DeviceCatalog, product: { name: string }): DevicePage | null {
    const scan = scanName(product.name)
    const modelPages = scan.models.map(m => catalog.bySlug.get(m.slug)).filter((p): p is DevicePage => !!p)
    if (modelPages.length === 1) return modelPages[0]
    const brandPages = [...scan.brands].map(b => catalog.bySlug.get(b)).filter((p): p is DevicePage => !!p && p.kind === 'brand')
    return brandPages.length === 1 ? brandPages[0] : null
}
