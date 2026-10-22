/**
 * Onopo Asistan: where the visitor is and what is in the cart, in the shape the chat API expects
 * (lib/assistant/contract.ts ChatRequest.context). Pure and isomorphic, so node --test can load it.
 *
 * Why here and not on the server: the chat API never sees the page URL (POST from a lazy chunk), and the
 * product slug is all it needs to put "that product first" in the turn context. Everything is validated
 * the same way the server validates it (slug /^[a-z0-9-]{1,120}$/, query ≤ 100), so a request built here
 * is never rejected as bad_request because of the page.
 */
import type { PageContext } from '@/lib/assistant/contract'

const SLUG = /^[a-z0-9-]{1,120}$/
const FACET = /^[a-z0-9-]{1,40}$/

/** First path segments that are app routes, never a product slug (app/*). */
const RESERVED = new Set([
    'admin', 'api', 'categories', 'kategori', 'login', 'maintenance', 'odeme', 'orders', 'page', 'product',
    'products', 'profile', 'register', 'siparis-basarili', 'siparis-hata',
])

/** CMS-backed top-level pages (app/help, app/policy, app/shipping, app/terms). */
const TOP_PAGES = new Set(['help', 'policy', 'shipping', 'terms'])

function segments(pathname: string): string[] {
    return (pathname || '/').split('?')[0].split('/').filter(Boolean)
}

/** True for a product page path ("/<slug>/"), the only page the PDP nudge runs on. */
export function isProductPath(pathname: string): boolean {
    const s = segments(pathname)
    return s.length === 1 && SLUG.test(s[0]) && !RESERVED.has(s[0]) && !TOP_PAGES.has(s[0])
}

/**
 * pathname (+ search string or URLSearchParams) → PageContext.
 *   /                      → home
 *   /<slug>/               → product
 *   /kategori/<slug>/      → category
 *   /products/?q=…&f=a,b   → listing
 *   /page/<slug>/, /help/  → page
 *   anything else          → other
 */
export function pageContext(pathname: string, search?: string | URLSearchParams | null): PageContext {
    const s = segments(pathname)
    if (s.length === 0) return { type: 'home' }
    if (s.length === 1) {
        if (s[0] === 'products') {
            const params = typeof search === 'string' || search == null ? new URLSearchParams(search ?? '') : search
            const ctx: { type: 'listing'; query?: string; facets?: string[] } = { type: 'listing' }
            const q = (params.get('q') ?? '').trim().slice(0, 100)
            if (q) ctx.query = q
            const facets = (params.get('f') ?? '')
                .split(',')
                .map(f => f.trim())
                .filter(f => FACET.test(f))
                .slice(0, 10)
            if (facets.length) ctx.facets = facets
            return ctx
        }
        if (TOP_PAGES.has(s[0])) return { type: 'page', slug: s[0] }
        if (isProductPath(pathname)) return { type: 'product', slug: s[0] }
        return { type: 'other' }
    }
    if (s.length === 2 && s[0] === 'kategori' && SLUG.test(s[1])) return { type: 'category', slug: s[1] }
    if (s.length === 2 && s[0] === 'page' && SLUG.test(s[1])) return { type: 'page', slug: s[1] }
    return { type: 'other' }
}

/**
 * Cart lines → { id, qty }[] for the request: the product id is the leading digits of the cart item id
 * ("123-45-6" is product 123 with options), ids ≤ 0 are dropped, qty is clamped to 1–99, at most 30 lines.
 */
export function cartContext(items: ReadonlyArray<{ id: number | string; quantity: number }>, max = 30): { id: number; qty: number }[] {
    const out: { id: number; qty: number }[] = []
    for (const item of items) {
        if (out.length >= max) break
        const id = parseInt(String(item.id), 10)
        if (!Number.isFinite(id) || id <= 0) continue
        const q = Math.round(Number(item.quantity))
        out.push({ id, qty: Number.isFinite(q) ? Math.min(99, Math.max(1, q)) : 1 })
    }
    return out
}
