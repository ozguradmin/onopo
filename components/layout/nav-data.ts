/**
 * Static navigation data and URL helpers for the store shell (header, mega menu, mobile menu, footer).
 * Isomorphic; no React.
 */
import type { MenuItem } from '@/lib/catalog'
import { LEGACY_CATEGORY_TARGETS } from '@/lib/seo'

export interface NavLinkItem {
    label: string
    href: string
}

/** Product-type quick links (lib/search FACETS keys → /products/?f=…). Facet links are rel="nofollow". */
export const PRODUCT_TYPE_LINKS = [
    { key: 'sarj-aleti', label: 'Şarj aletleri', short: 'Şarj aletleri', href: '/products/?f=sarj-aleti' },
    { key: 'kablo', label: 'Kablolar', short: 'Kablolar', href: '/products/?f=kablo' },
    { key: 'arac', label: 'Araç şarjı ve aksesuarları', short: 'Araç şarjı', href: '/products/?f=arac' },
    { key: 'powerbank', label: 'Powerbank', short: 'Powerbank', href: '/products/?f=powerbank' },
    { key: 'ekran-koruyucu', label: 'Ekran koruyucular', short: 'Ekran koruyucu', href: '/products/?f=ekran-koruyucu' },
    { key: 'kulaklik', label: 'Kulaklıklar', short: 'Kulaklık', href: '/products/?f=kulaklik' },
] as const

/** Connector / device quick links ("Cihazına göre"). */
export const CONNECTOR_LINKS = [
    { key: 'iphone', label: 'iPhone / Lightning', href: '/products/?f=iphone' },
    { key: 'type-c', label: 'Android / Type-C', href: '/products/?f=type-c' },
    { key: 'micro-usb', label: 'Micro USB', href: '/products/?f=micro-usb' },
    { key: '20w', label: 'Hızlı şarj (20W+)', href: '/products/?f=20w' },
    { key: 'orgulu', label: 'Örgülü kablolar', href: '/products/?f=orgulu' },
] as const

/** Popular searches shown in the empty search box (only those with results are shown). */
export const POPULAR_SEARCHES = ['Type-C kablo', 'iPhone şarj', 'Şarj aleti', 'Araç şarj', 'Powerbank', 'Ekran koruyucu', 'Kulaklık']

/** CMS pages (Admin › Sayfalar) at /page/<slug>/ plus account pages. */
export const SUPPORT_LINKS: NavLinkItem[] = [
    { label: 'Yardım merkezi', href: '/page/help/' },
    { label: 'Kargo ve iade', href: '/page/shipping/' },
    { label: 'Sipariş takibi', href: '/orders/' },
    { label: 'Gizlilik ve KVKK', href: '/page/policy/' },
    { label: 'Kullanım koşulları', href: '/page/terms/' },
]

/**
 * Old internal URLs that only redirect (or no longer exist) → their current target. The old listings
 * (/new/ "Yeni Gelenler" → /products/?sort=newest, /tech/, /beauty/, /gaming/) come from the table the
 * server redirects use, so a menu link never takes the 308 hop.
 */
const LEGACY_TARGETS: Record<string, string> = {
    ...Object.fromEntries(Object.entries(LEGACY_CATEGORY_TARGETS).map(([slug, target]) => [`/${slug}/`, target])),
    '/help/': '/page/help/',
    '/shipping/': '/page/shipping/',
    '/policy/': '/page/policy/',
    '/terms/': '/page/terms/',
    '/cart/': '/odeme/',
    '/checkout/': '/odeme/',
    '/sepet/': '/odeme/',
    '/uye-giris/': '/login/',
}

/** True for links that leave the site (or are not page links): render a plain <a>. */
export function isExternalHref(href: string): boolean {
    return /^(https?:|mailto:|tel:|\/\/|whatsapp:)/i.test(href.trim())
}

/**
 * Internal link as the canonical URL: leading slash, trailing slash before ?/#, legacy routes mapped
 * (dead /cart and /checkout → /odeme/). External and hash links are returned unchanged.
 */
export function normalizeHref(raw: string | null | undefined): string {
    const href = (raw ?? '').trim()
    if (!href) return '/'
    if (isExternalHref(href) || href.startsWith('#')) return href
    const absolute = href.startsWith('/') ? href : `/${href}`
    const m = absolute.match(/^([^?#]*)(.*)$/)
    let path = m ? m[1] : absolute
    const rest = m ? m[2] : ''
    if (!path.endsWith('/') && !/\.[a-z0-9]{2,5}$/i.test(path)) path += '/'
    const target = LEGACY_TARGETS[path.toLowerCase()]
    if (!target) return path + rest
    // '/new?x=1' → '/products/?sort=newest&x=1'
    return target.includes('?') && rest.startsWith('?') ? `${target}&${rest.slice(1)}` : target + rest
}

/** Same path (ignores trailing slash and query). */
export function samePath(a: string, b: string): boolean {
    const clean = (s: string) => (s.split(/[?#]/)[0] || '/').replace(/\/+$/, '') || '/'
    return clean(a) === clean(b)
}

/** Flat admin menus (Admin › Menüler) → top-level items with children (one level). */
export function buildMenuTree(flat: MenuItem[]): MenuItem[] {
    const items = flat.map(m => ({ ...m, children: [] as MenuItem[] }))
    const byId = new Map(items.map(m => [m.id, m]))
    for (const m of items) if (m.parent_id != null) byId.get(m.parent_id)?.children.push(m)
    return items.filter(m => m.parent_id == null || !byId.has(m.parent_id))
}

/** "500 ₺" for whole amounts, "499,90 ₺" otherwise (deterministic, no ICU). */
export function formatAmountShort(n: number): string {
    const whole = Math.round(n * 100) % 100 === 0
    const fixed = Math.abs(n).toFixed(whole ? 0 : 2)
    const [int, frac] = fixed.split('.')
    return `${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${frac ? ',' + frac : ''} ₺`
}

/** "+90 505 821 75 47" → "tel:+905058217547" */
export function telHref(phone: string): string {
    return `tel:${phone.replace(/[^\d+]/g, '')}`
}

/** WhatsApp chat link for a Turkish number ("0505…", "+90 505…", "505…") or null. */
export function whatsappHref(number: string | null | undefined, text?: string): string | null {
    let digits = (number ?? '').replace(/\D/g, '')
    if (!digits) return null
    if (digits.startsWith('0')) digits = '9' + digits
    else if (digits.length === 10) digits = '90' + digits
    if (digits.length < 11) return null
    return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
