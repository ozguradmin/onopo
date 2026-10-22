/**
 * URL resolution for the storefront routes, so every route answers with a real status:
 * 200 for a canonical URL, 308 to the canonical URL for duplicates/legacy URLs, 404 for everything else.
 *
 * Route usage (details and examples in docs/SEO.md, "Soft 404s"):
 *   app/[slug]/page.tsx          resolveSlugCached(slug)        -> product | redirect | notFound()
 *   app/product/[id]/page.tsx    resolveProductIdCached(id)     -> permanentRedirect(path) | notFound()
 *   app/kategori/[slug]/page.tsx resolveCategoryCached(slug)    -> page | permanentRedirect | notFound()
 *   app/page/[slug]/page.tsx     resolveCmsPageCached(slug)     -> page | notFound()
 *   app/products/page.tsx        resolveListingCategory(param)  -> permanentRedirect('/kategori/<slug>/')
 *                                listingSeo('/products/', searchParams, …) -> robots/canonical/out-of-range page
 */
import { cache } from 'react'
import { CATEGORY_SLUG_ALIASES, categoryPath, cmsPagePath, foldTr, LEGACY_CATEGORY_TARGETS, LISTING_NOINDEX_PARAMS, productPath, type D1Like } from './seo'

export type RedirectKind = 'permanent' | 'temporary'

export type SlugResolution =
    /** Product. redirect=null: render it. 'permanent': other spelling (case) of the slug. 'temporary': fuzzy match of an old slug. */
    | { kind: 'product'; id: number; slug: string; path: string; redirect: RedirectKind | null }
    /** A real category slug at the root (/cep-telefonu-aksesuarlari/), or a former one (CATEGORY_SLUG_ALIASES): 308 to /kategori/<slug>/. */
    | { kind: 'category'; slug: string; name: string; path: string; redirect: 'permanent' }
    /** /tech/ /gaming/ /beauty/ /new/ (old hard-coded listings with no products): 308 to their replacement. */
    | { kind: 'legacy-category'; slug: string; path: string; redirect: 'permanent' }
    /** A CMS page slug at the root (/help/ once app/help is removed): 308 to /page/<slug>/. */
    | { kind: 'page'; slug: string; path: string; redirect: 'permanent' }
    /** A URL of the old shop platform from LEGACY_PATH_REDIRECTS (/sepet/, /uye-giris/, /cart/, /checkout/): 308 to its replacement. */
    | { kind: 'legacy-path'; slug: string; path: string; redirect: 'permanent' }

/** Top-level paths owned by static routes. A product slug must never be one of these (the static route wins). */
export const RESERVED_SLUGS = [
    'admin', 'api', 'categories', 'help', 'kategori', 'login', 'maintenance', 'odeme', 'orders', 'page', 'policy',
    'product', 'products', 'profile', 'register', 'shipping', 'siparis-basarili', 'siparis-hata', 'terms',
    'cart', 'checkout', 'sepet', 'export', 'sitemap.xml', 'robots.txt',
] as const

/**
 * Replacements for the old hard-coded listings (VALID_CATEGORIES), defined in lib/seo.ts so the client menus can
 * use the same table. They have 0 products today; /new/ ("Yeni Gelenler") is /products/ sorted newest first.
 * If a category with the same slug gets products later, /kategori/<slug>/ is used instead (see legacyCategoryTarget).
 */
export { LEGACY_CATEGORY_TARGETS }

/**
 * Old URLs and their replacements (permanent). resolveSlug() answers the ones that reach app/[slug]
 * (/sepet/, /uye-giris/; /tech/ /beauty/ /new/ /gaming/ through LEGACY_CATEGORY_TARGETS). /help/ /policy/
 * /shipping/ /terms/ have their own route files with the same permanentRedirect(). Next's trailingSlash
 * redirect runs first, so /sepet takes /sepet → /sepet/ → /odeme/.
 * /help /policy /shipping /terms duplicate the CMS pages (and carry placeholder contacts): canonical is /page/<slug>/.
 * /sepet and /uye-giris are URLs of the old shop platform still requested from search engines.
 * /cart and /checkout are the links of the hidden Akakçe block (/cart?add=<id>, /checkout?product=<id>, lib/seo.ts
 * productInfoHtml, kept byte-identical): crawlers following them land on the cart/checkout page (the query is dropped).
 */
export const LEGACY_PATH_REDIRECTS: ReadonlyArray<{ source: string; destination: string; permanent: true }> = [
    { source: '/help', destination: '/page/help/', permanent: true },
    { source: '/policy', destination: '/page/policy/', permanent: true },
    { source: '/shipping', destination: '/page/shipping/', permanent: true },
    { source: '/terms', destination: '/page/terms/', permanent: true },
    { source: '/tech', destination: LEGACY_CATEGORY_TARGETS.tech, permanent: true },
    { source: '/beauty', destination: LEGACY_CATEGORY_TARGETS.beauty, permanent: true },
    { source: '/new', destination: LEGACY_CATEGORY_TARGETS.new, permanent: true },
    { source: '/gaming', destination: LEGACY_CATEGORY_TARGETS.gaming, permanent: true },
    { source: '/sepet', destination: '/odeme/', permanent: true },
    { source: '/uye-giris', destination: '/login/', permanent: true },
    { source: '/cart', destination: '/odeme/', permanent: true },
    { source: '/checkout', destination: '/odeme/', permanent: true },
]

/** Lower-case root slug ("sepet") → its LEGACY_PATH_REDIRECTS destination. */
function legacyPathTarget(slug: string): string | null {
    const hit = LEGACY_PATH_REDIRECTS.find((r) => r.source.slice(1).toLowerCase() === slug)
    return hit ? hit.destination : null
}

async function getDb(db?: D1Like): Promise<D1Like> {
    if (db) return db
    const { getDB } = await import('./db')
    return (await getDB()) as unknown as D1Like
}

/**
 * Decodes and validates a dynamic route segment. Returns null for anything that cannot be a slug
 * (dots = missing files like /og-image.png or /manifest.json, slashes, spaces, quotes, too long).
 */
export function normalizeSlugParam(raw: string | null | undefined): string | null {
    if (!raw) return null
    let s = String(raw)
    try { s = decodeURIComponent(s) } catch { return null }
    s = s.trim()
    if (!s || s.length > 200) return null
    if (!/^[A-Za-z0-9ÇĞİÖŞÜçğıöşü_-]+$/.test(s)) return null
    return s
}

/** Category slug (or name) -> where its listing lives, or null when it has no active product. */
export async function legacyCategoryTarget(slug: string, db?: D1Like): Promise<string | null> {
    const key = slug.toLowerCase()
    const own = await resolveCategory(key, db)
    if (own && own.productCount > 0) return own.path
    const fallback = LEGACY_CATEGORY_TARGETS[key]
    if (!fallback) return null
    if (fallback.startsWith('/kategori/')) {
        const target = await resolveCategory(fallback.split('/')[2], db)
        if (!target || target.productCount === 0) return '/products/'
    }
    return fallback
}

/**
 * A former category slug (CATEGORY_SLUG_ALIASES) → the category it was renamed to, or null. Only once no category
 * has the old slug any more (before the rename the old slug is still the real one), and only when the new slug
 * is a category with active products (else its listing would be a 404 anyway).
 */
export async function categorySlugAlias(slug: string, db?: D1Like): Promise<CategoryInfo | null> {
    const key = String(slug ?? '').trim().toLowerCase()
    const target = Object.prototype.hasOwnProperty.call(CATEGORY_SLUG_ALIASES, key) ? CATEGORY_SLUG_ALIASES[key] : null
    if (!target) return null
    const own = await resolveCategory(key, db)
    if (own && own.slug.toLowerCase() === key) return null
    const category = await resolveCategory(target, db)
    return category && category.slug.toLowerCase() === target && category.productCount > 0 ? category : null
}

function escapeLike(s: string): string {
    return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}

/**
 * Resolves the root segment /<slug>/:
 * 1. active product with exactly this slug -> render (redirect null)
 * 2. a category (real slug -> /kategori/<slug>/; legacy tech/gaming/beauty/new -> replacement; a former slug
 *    from CATEGORY_SLUG_ALIASES -> /kategori/<new slug>/) or an old shop URL from LEGACY_PATH_REDIRECTS
 *    (sepet, cart, checkout -> /odeme/, uye-giris -> /login/)
 * 3. a CMS page -> /page/<slug>/
 * 4. active product whose slug differs only in case -> permanent redirect
 * 5. fuzzy match of an old/renamed product slug (same rule the client used: up to 3 words of >2 chars,
 *    "onopo-" ignored, now at least 2 words) -> temporary redirect
 * 6. null -> call notFound() (real 404). Inactive products also resolve to null.
 */
export async function resolveSlug(raw: string, dbArg?: D1Like): Promise<SlugResolution | null> {
    const slug = normalizeSlugParam(raw)
    if (!slug) return null
    const db = await getDb(dbArg)

    const exact = await db.prepare('SELECT id, slug, is_active FROM products WHERE slug = ? LIMIT 1').bind(slug).first<{ id: number; slug: string; is_active: number | null }>()
    if (exact) {
        return Number(exact.is_active ?? 1) === 1
            ? { kind: 'product', id: Number(exact.id), slug: exact.slug, path: productPath(exact.slug), redirect: null }
            : null
    }

    const lower = slug.toLowerCase()
    const category = await resolveCategory(lower, db)
    if (category && category.slug.toLowerCase() === lower) {
        if (category.productCount > 0) return { kind: 'category', slug: category.slug, name: category.name, path: category.path, redirect: 'permanent' }
        const target = await legacyCategoryTarget(lower, db)
        if (target) return { kind: 'legacy-category', slug: category.slug, path: target, redirect: 'permanent' }
    } else if (LEGACY_CATEGORY_TARGETS[lower]) {
        const target = await legacyCategoryTarget(lower, db)
        if (target) return { kind: 'legacy-category', slug: lower, path: target, redirect: 'permanent' }
    } else {
        const renamed = await categorySlugAlias(lower, db)
        if (renamed) return { kind: 'category', slug: renamed.slug, name: renamed.name, path: renamed.path, redirect: 'permanent' }
    }

    const legacy = legacyPathTarget(lower)
    if (legacy) return { kind: 'legacy-path', slug: lower, path: legacy, redirect: 'permanent' }

    const page = await db.prepare('SELECT slug FROM pages WHERE slug = ? OR LOWER(slug) = ? LIMIT 1').bind(slug, lower).first<{ slug: string }>()
    if (page) return { kind: 'page', slug: page.slug, path: cmsPagePath(page.slug), redirect: 'permanent' }

    if (lower !== slug) {
        const ci = await db.prepare('SELECT id, slug FROM products WHERE is_active = 1 AND LOWER(slug) = ? LIMIT 1').bind(lower).first<{ id: number; slug: string }>()
        if (ci) return { kind: 'product', id: Number(ci.id), slug: ci.slug, path: productPath(ci.slug), redirect: 'permanent' }
    }

    const tokens = foldTr(lower).replace(/^onopo-/, '').split(/[-_]+/).filter((w) => w.length > 2).slice(0, 3)
    if (tokens.length >= 2) {
        const where = tokens.map(() => "slug LIKE ? ESCAPE '\\'").join(' AND ')
        const fuzzy = await db
            .prepare(`SELECT id, slug FROM products WHERE is_active = 1 AND ${where} ORDER BY (stock > 0) DESC, id DESC LIMIT 1`)
            .bind(...tokens.map((t) => `%${escapeLike(t)}%`))
            .first<{ id: number; slug: string }>()
        if (fuzzy && fuzzy.slug !== slug) return { kind: 'product', id: Number(fuzzy.id), slug: fuzzy.slug, path: productPath(fuzzy.slug), redirect: 'temporary' }
    }
    return null
}

/** /product/<id>/ -> the canonical /<slug>/ of an active product, or null (404). */
export async function resolveProductId(raw: string, dbArg?: D1Like): Promise<{ id: number; slug: string; path: string } | null> {
    const id = String(raw ?? '').replace(/\/+$/, '')
    if (!/^\d{1,10}$/.test(id)) return null
    const db = await getDb(dbArg)
    const row = await db.prepare('SELECT id, slug FROM products WHERE id = ? AND is_active = 1 LIMIT 1').bind(Number(id)).first<{ id: number; slug: string | null }>()
    if (!row || !row.slug) return null
    return { id: Number(row.id), slug: row.slug, path: productPath(row.slug) }
}

export interface CategoryInfo {
    id: number
    name: string
    slug: string
    path: string
    /** Active products (in stock or not), matched like /api/categories: products.category = name or slug, case-insensitive. */
    productCount: number
    inStockCount: number
}

/** Category by slug or by name (case-insensitive), with its product counts; null when unknown. */
export async function resolveCategory(slugOrName: string, dbArg?: D1Like): Promise<CategoryInfo | null> {
    const key = String(slugOrName ?? '').trim()
    if (!key || key.length > 200) return null
    const db = await getDb(dbArg)
    const row = await db
        .prepare(
            `SELECT c.id, c.name, c.slug,
                (SELECT COUNT(*) FROM products p WHERE (LOWER(p.category) = LOWER(c.name) OR LOWER(p.category) = LOWER(c.slug)) AND p.is_active = 1) AS product_count,
                (SELECT COUNT(*) FROM products p WHERE (LOWER(p.category) = LOWER(c.name) OR LOWER(p.category) = LOWER(c.slug)) AND p.is_active = 1 AND p.stock > 0) AS in_stock_count
             FROM categories c
             WHERE LOWER(c.slug) = LOWER(?) OR LOWER(c.name) = LOWER(?)
             ORDER BY (LOWER(c.slug) = LOWER(?)) DESC
             LIMIT 1`,
        )
        .bind(key, key, key)
        .first<{ id: number; name: string; slug: string; product_count: number; in_stock_count: number }>()
    if (!row) return null
    return {
        id: Number(row.id),
        name: row.name,
        slug: row.slug,
        path: categoryPath(row.slug),
        productCount: Number(row.product_count) || 0,
        inStockCount: Number(row.in_stock_count) || 0,
    }
}

/**
 * /products/?category=<name or slug> -> the path to redirect to (308), or null to keep today's behaviour.
 * Legacy slugs (tech, gaming, …) map to their replacement listing.
 */
export async function resolveListingCategory(param: string | string[] | null | undefined, dbArg?: D1Like): Promise<string | null> {
    const value = (Array.isArray(param) ? param[0] : param || '').trim()
    if (!value) return null
    const db = await getDb(dbArg)
    const cat = await resolveCategory(value, db)
    if (cat && cat.productCount > 0) return cat.path
    if (!cat) {
        const renamed = await categorySlugAlias(value, db)
        if (renamed) return renamed.path
    }
    // Path only: app/products appends the visitor's own listing query (a legacy target such as
    // '/products/?sort=newest' would otherwise end up as '/products/?sort=newest?page=2').
    const target = await legacyCategoryTarget(cat ? cat.slug : value, db)
    return target ? target.split('?')[0] : null
}

export interface CmsPage {
    slug: string
    title: string
    content: string
    updatedAt: string | null
    path: string
}

/** CMS page (Admin › Sayfalar) by slug; null -> notFound(). */
export async function resolveCmsPage(raw: string, dbArg?: D1Like): Promise<CmsPage | null> {
    const slug = normalizeSlugParam(raw)
    if (!slug) return null
    const db = await getDb(dbArg)
    const row = await db.prepare('SELECT slug, title, content, updated_at FROM pages WHERE slug = ? LIMIT 1').bind(slug).first<{ slug: string; title: string; content: string | null; updated_at: string | null }>()
    if (!row) return null
    return { slug: row.slug, title: row.title, content: row.content || '', updatedAt: row.updated_at, path: cmsPagePath(row.slug) }
}

type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams | null | undefined

function paramOf(sp: SearchParamsLike, key: string): string {
    if (!sp) return ''
    if (typeof (sp as URLSearchParams).get === 'function') return ((sp as URLSearchParams).get(key) || '').trim()
    const v = (sp as Record<string, string | string[] | undefined>)[key]
    return (Array.isArray(v) ? v[0] || '' : v || '').trim()
}

export interface ListingSeo {
    /** Current page (1-based; invalid values -> 1). */
    page: number
    /** Last page when totalItems/pageSize were given. */
    lastPage: number | null
    /** page > lastPage: call notFound(). */
    outOfRange: boolean
    /** A search/filter/sort parameter is present: render noindex,follow (and no canonical). */
    noindex: boolean
    /** The search term (q, or the legacy search param), if any. */
    query: string | null
    /** Pass to buildMetadata({ path, query: canonicalQuery }) — keeps only ?page=N for N > 1. */
    canonicalQuery: { page?: number }
}

/**
 * Index rules for listing pages (/products/, /kategori/<slug>/):
 * - page 1 without parameters: index, canonical = base path
 * - ?page=N (N ≥ 2, within range): index, self-canonical with ?page=N
 * - q / search / f / sort / minPrice / maxPrice / brand, or a ?category= that did not redirect: noindex,follow, no canonical
 * - page beyond the last page: 404
 * Unknown parameters (utm_*, gclid, …) are ignored: the canonical simply leaves them out.
 */
export function listingSeo(searchParams: SearchParamsLike, opts: { totalItems?: number; pageSize?: number } = {}): ListingSeo {
    const pageRaw = paramOf(searchParams, 'page')
    const parsed = /^\d{1,6}$/.test(pageRaw) ? parseInt(pageRaw, 10) : 1
    const page = parsed >= 1 ? parsed : 1
    const lastPage = opts.totalItems !== undefined && opts.pageSize ? Math.max(1, Math.ceil(opts.totalItems / opts.pageSize)) : null
    const query = paramOf(searchParams, 'q') || paramOf(searchParams, 'search') || null
    const noindex = LISTING_NOINDEX_PARAMS.some((k) => paramOf(searchParams, k) !== '')
    return {
        page,
        lastPage,
        outOfRange: lastPage !== null && page > lastPage,
        noindex,
        query,
        canonicalQuery: page > 1 ? { page } : {},
    }
}

/** Per-request memoized versions for use in both generateMetadata() and the page component. */
export const resolveSlugCached = cache((slug: string) => resolveSlug(slug))
export const resolveProductIdCached = cache((id: string) => resolveProductId(id))
export const resolveCategoryCached = cache((slug: string) => resolveCategory(slug))
export const resolveCmsPageCached = cache((slug: string) => resolveCmsPage(slug))
