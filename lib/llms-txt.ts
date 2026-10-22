/**
 * /llms.txt (https://llmstxt.org): a short Markdown summary of the store for AI assistants and answer engines
 * (H1 store name, a blockquote summary, the store facts, then sections of links). app/llms.txt/route.ts loads
 * the data live from D1 on every render (edge-cached like the sitemap, invalidated by cache_version); this file
 * only formats it, so scripts/llms-txt.test.mjs can check it.
 *
 * Honesty rules (as for the meta descriptions and JSON-LD, docs/SEO.md §2 and §4): every fact comes from the data
 * passed in (shipping_settings, the CMS "shipping" page, site_settings, the max installments, the catalogue).
 * A fact whose data is missing is left out, never filled with a default. Prices are what checkout charges
 * (lib/pricing.ts unitPrice), passed in already rounded.
 */
import { SITE_URL } from './seo'
import { formatNumberTR } from './format'

export interface LlmsLink {
    label: string
    /** Site path ('/kategori/x/') or absolute URL. */
    path: string
    /** Text after the link ("109 ürün", a price, a description). */
    note?: string
}

export interface LlmsSection {
    title: string
    /** Optional sentence under the heading. */
    intro?: string
    links: LlmsLink[]
}

export interface LlmsTxtData {
    siteName: string
    /** Plural product types found in the catalogue, most frequent first ('ekran koruyucular'). */
    productTypes: string[]
    freeShippingThreshold: number | null
    shippingCost: number | null
    /** Active products with free shipping whatever the total (products.free_shipping). */
    freeShippingProducts?: number
    handlingTime: { minDays: number; maxDays: number } | null
    returnPolicy: { days: number; freeReturn: boolean } | null
    /** lib/catalog getMaxInstallments: null when no card payment provider is active and configured. */
    maxInstallments: number | null
    contact: { whatsapp?: string | null; phone?: string | null; email?: string | null }
    categories: LlmsLink[]
    guides: LlmsLink[]
    /** Further sections from other modules (e.g. device pages), placed after the guides. */
    extraSections?: LlmsSection[]
    products: Array<{ name: string; path: string; price: number }>
    /** Active products in all (in stock and sold out), for the "Tüm ürünler" line. */
    productTotal: number
    pages: LlmsLink[]
}

/** Markdown-safe link label: one line, no brackets. */
function label(text: string): string {
    return text.replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim()
}

function oneLine(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

function absolute(path: string): string {
    return /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

/** "500 TL", "79,99 TL": whole amounts without decimals. */
export function tl(amount: number): string {
    return `${formatNumberTR(amount, Number.isInteger(amount) ? 0 : 2)} TL`
}

function joinTr(items: string[]): string {
    if (items.length <= 1) return items[0] || ''
    return `${items.slice(0, -1).join(', ')} ve ${items[items.length - 1]}`
}

function linkLine(l: LlmsLink): string {
    return `- [${label(l.label)}](${absolute(l.path)})${l.note ? `: ${oneLine(l.note)}` : ''}`
}

function section(title: string, links: LlmsLink[], intro?: string): string[] {
    if (!links.length) return []
    return ['', `## ${title}`, '', ...(intro ? [oneLine(intro), ''] : []), ...links.map(linkLine)]
}

/** The store facts as list items, each only when its data is there. */
export function storeFacts(d: LlmsTxtData): string[] {
    const facts: string[] = []
    const threshold = d.freeShippingThreshold
    const cost = d.shippingCost
    if (cost === 0) facts.push('Kargo: tüm siparişlerde kargo bedava.')
    else if (cost != null && threshold != null && threshold > 0) {
        facts.push(`Kargo: ${tl(threshold)} ve üzeri siparişlerde kargo bedava; altındaki siparişlerde kargo ücreti ${tl(cost)}.${d.freeShippingProducts ? ' Ürün sayfasında "kargo bedava" yazan ürünlerde kargo her tutarda bedava.' : ''}`)
    } else if (cost != null) facts.push(`Kargo: kargo ücreti ${tl(cost)}.`)
    if (d.handlingTime) {
        facts.push(`Kargoya veriliş: siparişler ödeme onayından sonra ${d.handlingTime.minDays}-${d.handlingTime.maxDays} iş günü içinde kargoya verilir.`)
    }
    if (d.returnPolicy) {
        facts.push(`İade: teslimattan itibaren ${d.returnPolicy.days} gün içinde iade talebinde bulunulabilir${d.returnPolicy.freeReturn ? '; anlaşmalı kargo firmasıyla gönderilen iadelerde kargo ücretini mağaza karşılar' : ''}.`)
    }
    if (d.maxInstallments) {
        facts.push(`Ödeme: kredi kartı veya banka kartıyla, PayTR güvenli ödeme altyapısı üzerinden; kredi kartına ${d.maxInstallments} aya varan taksit (seçenekler ödeme adımında kartın bankasına göre gösterilir).`)
    }
    facts.push('Fiyatlar Türk lirasıdır (TL). Ürünün sitede gösterilen fiyatı ödemede alınan tutardır; kargo ücreti varsa ödeme adımında eklenir.')
    const contact = [
        d.contact.whatsapp ? `WhatsApp ${oneLine(d.contact.whatsapp)}` : null,
        d.contact.phone ? `telefon ${oneLine(d.contact.phone)}` : null,
        d.contact.email ? `e-posta ${oneLine(d.contact.email)}` : null,
    ].filter((x): x is string => Boolean(x))
    if (contact.length) facts.push(`İletişim: ${contact.join(', ')}.`)
    return facts
}

export function buildLlmsTxt(d: LlmsTxtData): string {
    const types = d.productTypes.slice(0, 5)
    const summary = `${d.siteName} (${SITE_URL}/), Türkiye'de online satış yapan bir teknoloji aksesuarı mağazası${types.length ? `: ${joinTr(types)}` : ''}. Bu dosyadaki fiyat, stok ve mağaza bilgileri sitenin veritabanından okunur.`
    const lines: string[] = [`# ${oneLine(d.siteName)}`, '', `> ${summary}`, '', 'Mağaza bilgileri:', '', ...storeFacts(d).map(f => `- ${f}`)]

    lines.push(...section('Kategoriler', d.categories))
    lines.push(...section('Alışveriş rehberleri', d.guides))
    for (const s of d.extraSections ?? []) lines.push(...section(s.title, s.links, s.intro))
    lines.push(...section(
        'Ürünler',
        d.products.map(p => ({ label: p.name, path: p.path, note: tl(p.price) })),
        `Stokta olan ${d.products.length} ürün, son 30 günde en çok görüntülenenler önce. Fiyatlar ödemede alınan tutardır.`,
    ))
    lines.push(...section('Mağaza sayfaları', d.pages))
    lines.push(...section('Optional', [
        { label: 'Tüm ürünler', path: '/products/', note: `${d.productTotal} ürün` },
        { label: 'Site haritası', path: '/sitemap.xml' },
    ]))
    return `${lines.join('\n')}\n`
}
