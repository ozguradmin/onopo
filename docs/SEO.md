# SEO rules for onopostore.com

Every storefront page must follow these rules. The helpers are in `lib/seo.ts` (metadata, titles,
descriptions, JSON-LD), `lib/seo-routing.ts` (URL resolution, redirects, 404s, listing index rules) and
`components/seo/` (`JsonLd`, `ProductMachineData`). The site-wide files are `app/robots.ts` and `app/sitemap.ts`.

Integrations depend on some of this. **Akakçe** crawls `sitemap.xml` and `/<slug>/` product pages.
**Google Merchant** fetches `/api/feeds/google` from www. Read the "Akakçe crawl contract" section before you
change a product page.

---

## 1. URL map (canonical URLs)

All canonical URLs use the apex host `https://onopostore.com`, end in a trailing slash (`trailingSlash: true`),
and carry no query string. The only exception is `?page=N` (N ≥ 2) on listings.

| Page | Canonical URL | Helper | Notes |
|---|---|---|---|
| Home | `/` | `canonicalUrl('/')` | |
| All products | `/products/` | | `?page=N` is self-canonical; search/filter/sort variants are noindex (§6) |
| Category | `/kategori/<category-slug>/` | `categoryPath(slug)` | `/products/?category=<name or slug>` → 308 here |
| Product | `/<product-slug>/` | `productPath(slug)` | **Never change this format.** Akakçe, both feeds, the sitemap and JSON-LD use it |
| CMS page | `/page/<slug>/` | `cmsPagePath(slug)` | help, shipping, policy, terms, and any page added in Admin › Sayfalar |
| `/product/<id>/` | → 308 `/<slug>/` | `resolveProductId(id)` | 404 for unknown or inactive ids |
| `/help/ /policy/ /shipping/ /terms/` | → 308 `/page/<slug>/` | `LEGACY_PATH_REDIRECTS` | `app/help` etc. only call `permanentRedirect` now |
| `/tech/ /beauty/` | → 308 `/products/` | `LEGACY_CATEGORY_TARGETS` | Legacy hard-coded listings; 0 products |
| `/new/` ("Yeni Gelenler") | → 308 `/products/?sort=newest` | `LEGACY_CATEGORY_TARGETS` | Menus link to the target directly (`components/layout/nav-data.ts`). The target is a sort variant: noindex and disallowed in robots.txt, like every `?sort=` URL. `/products/?category=new` still goes to `/products/` |
| `/gaming/` | → 308 `/kategori/oyun-ve-oyuncu-aksesuarlari/` | `LEGACY_CATEGORY_TARGETS` | Falls back to `/products/` if that category has no active product |
| `/sepet/`, `/uye-giris/` | → 308 `/odeme/`, `/login/` | `LEGACY_PATH_REDIRECTS` | URLs from the old shop platform. `resolveSlug` returns kind `'legacy-path'` (they were 404 before) |
| `/cart/`, `/checkout/` | 404 | | Only linked from the hidden Akakçe block; disallowed in robots.txt |
| Guides hub | `/rehber/` | `GUIDES_PATH` | Shopping guides ("Alışveriş rehberleri"); see §12 |
| Guide | `/rehber/<slug>/` | `guidePath(slug)` | Text in code (`lib/guides`); unknown slug 404, other case 308 |
| `/llms.txt` | (a text file, no canonical) | | Store summary for AI assistants (§13). Not in the sitemap; reserved slug, live redirect target |
| `/<INDEXNOW_KEY>.txt` | (a text file) | | IndexNow key file, answered by `worker.ts` (§13) |
| Devices hub | `/cihaz/` | `DEVICES_PATH` | "Cihaza göre": brands and models with counts; see §14 |
| Device page | `/cihaz/<slug>/` | `devicePath(slug)` | Brand or model with ≥ 3 active products (`lib/devices`); unknown slug 404, other case 308; noindex (200) without an in-stock product, or a model page with < 3 products naming the model |
| Utility pages | (no canonical, noindex) | `privatePageMetadata` | `/odeme/ /profile/ /orders/ /login/ /register/ /siparis-basarili/ /siparis-hata/ /maintenance/ /admin/*`. `/admin` and `/admin/*` also send `X-Robots-Tag: noindex, nofollow` (`next.config.ts`), because the admin client app has no page metadata |

`LEGACY_CATEGORY_TARGETS` lives in `lib/seo.ts` (client-safe, so the menus can use it) and is re-exported from
`lib/seo-routing.ts`. `resolveSlug`, `LEGACY_PATH_REDIRECTS` and the menu link normaliser all read this one table.

The forms without a trailing slash (`/help`, `/new`, `/sepet` …) take two hops: Next's own trailing-slash 308
runs before any route, then the legacy redirect. The slash forms are one hop.

**Why `/page/<slug>/` for CMS pages.** The footer links there, and it is a namespace of its own: a new CMS page
can never collide with a product slug at the root. The old hard-coded copies of help, policy, shipping and terms
(with placeholder contacts) are gone: `app/help`, `app/policy`, `app/shipping` and `app/terms` now only redirect
to `/page/<slug>/`.

**Reserved slugs.** `RESERVED_SLUGS` lists the top-level static routes. A product with one of these slugs would
be shadowed, so the product slug generator (`app/api/products/route.ts`) should reject them; it does not check
them yet. No product uses one today.

**www and http.** `worker.ts` does this (`canonicalRedirect` in `lib/edge-cache.ts`), not `next.config.ts` and
not a Cloudflare rule. GET/HEAD requests for pages on `http://` or `www.onopostore.com` get a 301 to
`https://onopostore.com` with the same path and query. `/api/*` is never redirected: checkout POSTs happen on
www, PayTR and BirFatura call the apex, and Merchant fetches the feed from www. `/sitemap.xml` and `/robots.txt`
stay on the host they were requested on (only http → https), because the Akakçe bot reads
`https://www.onopostore.com/sitemap.xml`. Other hosts (127.0.0.1; workers.dev and preview URLs are switched off in
`wrangler.toml`) are left alone. Canonicals point
at the apex whichever host served the page.

**Tracking parameters** (`utm_*`, `gclid`, `srsltid`, `fbclid`, `msclkid` …) are removed by `worker.ts` from the
URL Next renders and from the edge-cache key. The browser keeps its address; server code never sees them.

## 2. Metadata (`<head>`)

### Root layout (`app/layout.tsx`)

- `generateMetadata` spreads `rootMetadata` from `lib/seo.ts` and adds the favicon. `rootMetadata` sets:
  - `metadataBase`
  - the title template `%s | Onopo` and the default title and description
  - Open Graph and Twitter defaults with the existing **`/og-image.jpg`** (1024×1024)
  - robots `index,follow` with `max-image-preview:large`
- The layout emits no canonical (each page sets its own), no `verification.google` placeholder (Search
  Console is verified by DNS), no feed `<link rel="alternate">` tags and no Google Fonts preconnects (next/font
  hosts the fonts itself).
- `/og-image.png` does not exist; nothing may reference it. The fallback is `DEFAULT_OG_IMAGE` (`/og-image.jpg`).
- Organization and WebSite JSON-LD: the root layout renders `organizationJsonLd(site)` and `websiteJsonLd(site)`
  with `<JsonLd>` (`site = await getSiteSeo()`). Do not render them again on a page.
  - `sameAs` contains only real brand profiles from `site_settings`.
  - `contactPoint` is added only when `footer_phone` is set.

### Every page

```ts
import { buildMetadata } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

export async function generateMetadata(): Promise<Metadata> {
    const site = await getSiteSeo()
    return buildMetadata({
        title: '…',            // without the brand; the template adds " | Onopo"
        description: '…',      // 140–160 chars, Turkish, built from real data (helpers below)
        path: '/kategori/x/',   // canonical path; trailing slash is added if missing
        query: { page },        // only on listings; page 1 is dropped automatically
        images: [product.images[0]],  // optional; '/api/images/<key>' is resolved to https://images.onopostore.com/<key>
                                      // (product pages pass the 1200w WebP variant once image variants are enabled)
        noindex: false,         // true -> robots noindex,follow and NO canonical tag
        site,                   // twitter:site from site_settings.twitter_url
    })
}
```

`buildMetadata` always emits an absolute self-canonical URL with a trailing slash, plus `og:url`, `og:site_name`,
`og:locale` (tr_TR), `og:title`, `og:description` and `og:image` (falling back to og-image.jpg), and
`twitter:card` (summary_large_image). Page-level `openGraph` replaces the layout's object entirely, so never
hand-write a partial `openGraph`. Use `buildMetadata`.

### Titles (`<title>` ≤ 60 characters including " | Onopo")

| Page | Title source |
|---|---|
| Home | `buildMetadata({ absoluteTitle: homeTitle(productNames), … })`, e.g. "Onopo Store \| Ekran Koruyucu, Şarj Kablosu ve Şarj Aleti" |
| Product | `productTitle(product.name)`: ≤ 52 chars. It drops the leading "onopo", marketing segments and filler words only as far as needed, and keeps the product type, specs (W, A, m, cm, mAh) and model code. Examples: "T120 USB-A to Type-C Şarj Kablosu 120W GaN 1 Metre", "Type-C to USB 3.4A Hızlı Şarj ve Data Kablosu 1M Q7", "iPhone 13 Pro Max Seramik 12D Cam Ekran Koruyucu". Never shorten `product.name` itself: feeds and invoices use it. |
| Category | `categoryTitle(name, page)` → "Cep Telefonu Aksesuarları Modelleri ve Fiyatları" (page ≥ 2: "… Fiyatları - Sayfa 2"). A category that is a selection, not a product type ("Çok Satanlar", "Yeni Gelenler", indirim, kampanya …: `MERCHANDISING_CATEGORY`), keeps its plain name: "Çok Satanlar" |
| /products/ | "Tüm Ürünler" (page ≥ 2: "Tüm Ürünler - Sayfa N"); search: `«${q}» için arama sonuçları` (noindex) |
| CMS page | `page.title` from the pages table ("Kargo ve İade") |
| Utility | a plain title ("Sepetim", "Giriş Yap") + `privatePageMetadata` |

`cleanTitle()` strips old suffixes such as "- ONOPO" and "| Onopo Store" that the template would duplicate.

### Descriptions (Turkish, 140–160 characters, from real data)

| Page | Helper |
|---|---|
| Product | `productMetaDescription(product, site)`. It takes the first real sentence(s) of the description body (the repeated name, category label, emoji, a leading "Model - CODE" label and the spec table are removed) and adds facts from the settings: "Kargo bedava" or "500 TL üzeri kargo bedava", "14 gün iade", "güvenli ödeme", plus "Şu an stokta yok." when stock ≤ 0. **Model phrase:** many descriptions come from one template per product family. When the fitted text names neither the device nor the model code (`productModelTokens`), `withModelPhrase` puts a short phrase in front ("iPhone 13 Pro Max ekran koruyucu: …", "Onopo Q8 şarj kablosu: …"), so every product page has its own description. |
| Category | `categoryMetaDescription(name, { count, minPrice, productNames }, site, page)` → "Cep Telefonu Aksesuarları: 109 ürün, 79,99 TL'den başlayan fiyatlarla. Ekran koruyucular, …" |
| /products/ | `listingMetaDescription({ count, minPrice, productNames }, site, { query, page })` → "Tüm ürünler: …" |
| Home | `homeMetaDescription(productNames, site)` |
| CMS | `cmsPageDescription(title, content)` |

Category and /products/ descriptions share one lead, `"<Name>[ - Sayfa N]: <count> ürün, <min price> TL'den
başlayan fiyatlarla. <Types> Onopo'da."`. On paginated listings the page marker sits in front, so it is never cut
and page N never repeats page 1's description. A filler ("Onopo Store'da.") is not added when the text already
contains it.

The facts are not hard-coded. The free-shipping threshold comes from `shipping_settings`, and the 14-day return
from the CMS "shipping" page text. If the owner edits either, the descriptions and JSON-LD follow on the next
render (`getSiteSeo()` is cached per request only; the admin write also bumps the edge-cache version).

## 3. Headings, breadcrumbs, internal links, images

- **One visible `<h1>` per page.**
  - Home: one real H1 in the "Onopo Store hakkında" block at the bottom (`HomeAbout` in `components/home/HomeHero.tsx`, `id="home-title"`); the top of the page is the campaign slider and the products.
  - Category: the category name.
  - /products/: "Tüm Ürünler", or `Arama: “q”` for a search. `?sort=newest` with no search or filter (the
    "Yeni Gelenler" target) has H1, breadcrumb and title "Yeni Gelenler" (still noindex,follow, no canonical);
    menu links to noindex listing variants carry `rel="nofollow"`.
  - Product: `product.name`.
  - CMS: the page title.
- The hidden Akakçe block has its own `<h1 id="product-name">`. Keep it (contract), and **do not give the visible
  H1 `id="product-name"` or any other id used in the hidden block** (`product-price`, `product-sku`, …), because
  duplicate ids break parsers. Use e.g. `id="pdp-title"` or no id.
- Use H2 for page sections ("Ürün açıklaması", "Benzer ürünler", …), not more H1s, and never use headings for styling.
- **Breadcrumbs.** Render them visibly on category, product and CMS pages, and output the same items with
  `breadcrumbJsonLd()`:
  - Product: Anasayfa `/` › {category name} `/kategori/<slug>/` › {product name} (no URL for the last item)
  - Category: Anasayfa › {category}
  - CMS: Anasayfa › {title}
  - Product category: `products.category` stores the category **name**. Find the slug with
    `resolveCategory(product.category)`. If none is found, use "Tüm Ürünler" `/products/`.
- **Internal links** always point at the canonical URL with a trailing slash:
  - `productPath(p.slug)`. Never `/product/<id>`, never `/<slug>` without the slash.
  - `categoryPath(c.slug)`. Never `/products?category=<Name>`.
  - `cmsPagePath(slug)`
  - Use `next/link` for internal links.
  - Facet/sort links (`?f=`, `?sort=`) get `rel="nofollow"`.
  - Pagination links are plain `<a href="?page=N">` (crawlable).
- **Images.**
  - Product images get `alt={product.name}`. In galleries use `"${name} - görsel ${i + 1}"`.
  - Decorative images get `alt=""`.
  - Always set `width`/`height` (or `aspect-ratio`) to avoid layout shift.
  - Only the first product image (the LCP image) gets `fetchpriority="high"`; everything below the fold is
    `loading="lazy"`.
  - Use the images.onopostore.com URLs (`getImageUrl` / `resolveImageUrl`). `/api/images/<key>` URLs stay valid
    because stored data uses them, but they go through the Worker.

## 4. Structured data (JSON-LD), per page

Render with `<JsonLd data={…} />` from `components/seo/JsonLd.tsx`, on the server.

| Page | JSON-LD |
|---|---|
| Root layout (every page) | `organizationJsonLd(site)` (OnlineStore, with the return policy) + `websiteJsonLd(site)` (SearchAction → `/products/?q={search_term_string}`) |
| Product | `<ProductMachineData product={row} site={site} reviews={{ count, average }} />` + `breadcrumbJsonLd([...])` + `faqPageJsonLd` of the visible "Sık sorulan sorular" (§13; only when it has items) |
| Category | `breadcrumbJsonLd` + `itemListJsonLd(productsOnThisPage.map(p => ({ path: productPath(p.slug), name: p.name })), { startIndex })` |
| /products/ (page 1, no filters) | `itemListJsonLd(...)` (optional) |
| CMS | `breadcrumbJsonLd` |
| Guide (`/rehber/<slug>/`) | `breadcrumbJsonLd` (Anasayfa › Rehberler › title) + `articleJsonLd` (publisher/author = the store's Organization `@id`, datePublished/dateModified) + `faqPageJsonLd` (only the FAQ shown on the page) + `itemListJsonLd` of the related products shown |
| Guides hub | `breadcrumbJsonLd` + `itemListJsonLd` of the guides |
| Device page (`/cihaz/<slug>/`) | `breadcrumbJsonLd` (Anasayfa › Cihazlar › [brand ›] page) + `itemListJsonLd` of the products shown (left out when noindex) |
| Devices hub | `breadcrumbJsonLd` + `itemListJsonLd` of the indexable device pages |

`productJsonLd` (used by `ProductMachineData`) builds the following, from real data only:

- name, description, absolute `image[]`
- `sku` = product_code or `ONOPO-<id>`, and `mpn` = product_code when set
- brand: always `"ONOPO"`. Akakçe has matched on that exact value for every product since launch, so it stays
  until Akakçe confirms a change. `productBrand()` gives the real brand ("Onopo", a spec-table brand such as
  "Ally", or none) where a page needs it.
- `gtin8`/`gtin12`/`gtin13`/`gtin14` (by length): `products.gtin` (Admin › Ürünler "Barkod (GTIN/EAN)") when it
  has a valid GS1 check digit, else a valid barcode from the description's spec table, else none (`lib/gtin.ts`)
- offers:
  - `price` = `roundPrice(price).toFixed(2)`, the exact amount checkout charges
  - `priceCurrency` TRY
  - `availability` InStock/OutOfStock from stock
  - `itemCondition` NewCondition
  - `seller`
- `shippingDetails` (TR):
  - rate 0 when `free_shipping=1` or the price ≥ the `shipping_settings` threshold, otherwise the real shipping cost
  - `deliveryTime`: handling from the CMS shipping page ("0-1 iş günü", default 0-1), transit 1-2 days
    (`DEFAULT_TRANSIT_TIME`: product pages say "ertesi gün teslim", Merchant Center allows at most 2 transit days)
- `hasMerchantReturnPolicy` (TR, 14 days, by mail, free return with the contracted carrier). It comes from the CMS
  "shipping" page and is left out if that text no longer states a return window.
- `aggregateRating` only when the product has reviews (pass `{ count, average }` from the `reviews` table). Never
  invent ratings.
- `review`: up to 5 of those real reviews (newest first; author = the shown name "Ayşe K.", rating, date, text when
  there is one), only together with `aggregateRating` (`reviewItems` on `ProductMachineData`).

Validate with Google's Rich Results Test after deploy.

## 5. Soft 404s → real 404s and redirects

Unknown slugs, `/product/999999/`, `/page/yok/`, `/cart/` and missing files (`/og-image.png`,
`/apple-touch-icon.png`, `/manifest.json`) used to answer 200. The routes below now use the resolvers. Each one
returns what to do, or `null` for a real 404. Use the `…Cached` variants (React `cache`) so `generateMetadata`
and the page share one DB lookup.

Next 16 answers a `notFound()` thrown by a page with status 404 and noindex, but with an empty `__next_error__`
HTML body; the 404 view renders in the browser (docs/FRONTEND.md §9). The status code is what crawlers use.

```tsx
// app/[slug]/page.tsx
import { notFound, permanentRedirect, redirect } from 'next/navigation'
import { resolveSlugCached } from '@/lib/seo-routing'

export async function generateMetadata({ params }) {
    const r = await resolveSlugCached((await params).slug)
    if (!r || r.kind !== 'product' || r.redirect) return {}   // the page decides; avoid metadata for redirects/404s
    /* load product, return buildMetadata({...}) */
}

export default async function Page({ params }) {
    const r = await resolveSlugCached((await params).slug)
    if (!r) notFound()                                           // 404: unknown slug, inactive product, file names with '.'
    if (r.kind !== 'product') permanentRedirect(r.path)          // category -> /kategori/x/, legacy -> /products/…, CMS -> /page/x/
    if (r.redirect === 'permanent') permanentRedirect(r.path)    // other case of the slug (308)
    if (r.redirect === 'temporary') redirect(r.path)             // old/renamed slug, fuzzy match (307, as today but on the server)
    /* render the product r.id */
}
```

```tsx
// app/product/[id]/page.tsx: no generateMetadata needed
const r = await resolveProductIdCached((await params).id)
r ? permanentRedirect(r.path) : notFound()

// app/page/[slug]/page.tsx (make it a server component)
const page = await resolveCmsPageCached(slug); if (!page) notFound()

// app/kategori/[slug]/page.tsx
const c = await resolveCategoryCached(slug)
if (!c) notFound()
if (c.slug !== slug) permanentRedirect(c.path)   // e.g. a name or a different case was used
// c.productCount === 0 -> render the empty state with buildMetadata({ noindex: true }); it is not in the sitemap

// app/products/page.tsx
const target = await resolveListingCategory(sp.category); if (target) permanentRedirect(target)
```

Rules:

- **Inactive products** (`is_active = 0`, e.g. test product 1207) return 404, and so does `/product/<their id>/`.
  Out-of-stock but active products stay 200 with `OutOfStock`.
- **Do not put `loading.tsx` or a `<Suspense>` around the page content** in `app/[slug]`, `app/product/[id]`,
  `app/page/[slug]`, `app/kategori/[slug]` and `app/products`. Once the shell has streamed, `notFound()` and
  redirects can no longer change the status code: the response stays 200 with a meta noindex. Call the resolver
  first, before any other await. Show skeletons inside client components instead.
- `notFound()` renders `app/not-found.tsx`. It must send no canonical; `buildMetadata` is not called for it.
- Verify with curl after the change:
  `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:<port>/yok-boyle-bir-sayfa/` → 404, `/product/999999/`
  → 404, `/og-image.png` → 404, `/product/1206/` → 308, `/cep-telefonu-aksesuarlari/` → 308
  `/kategori/cep-telefonu-aksesuarlari/`, `/tech/` → 308 `/products/`, `/new/` → 308 `/products/?sort=newest`,
  `/sepet/` → 308 `/odeme/`, `/uye-giris/` → 308 `/login/`.

## 6. Listings: index rules, pagination, filters

```ts
import { listingSeo } from '@/lib/seo-routing'
const sp = await searchParams
const ls = listingSeo(sp, { totalItems: total, pageSize: perPage })   // perPage = site_settings.products_per_page (20)
if (ls.outOfRange) notFound()
return buildMetadata({ title, description, path: '/products/', query: ls.canonicalQuery, noindex: ls.noindex, site })
```

| URL | Robots | Canonical |
|---|---|---|
| `/products/`, `/kategori/x/` | index, follow | self |
| `?page=N` (2 ≤ N ≤ last page) | index, follow | self, with `?page=N`; title and description get "Sayfa N" |
| `?page=N` beyond the last page | 404 | |
| `?q=` / `?search=` (search) | noindex, follow | none |
| `?f=`, `?sort=`, `?minPrice=`, `?maxPrice=`, `?brand=`, `?discounted=`, `?inStock=` | noindex, follow | none |
| `?category=` that did not redirect (unknown/empty category) | noindex, follow | none |
| `utm_*`, `gclid`, … | ignored (worker.ts strips them before Next renders) | self without them |

- Search, filter and sort URLs are also disallowed in robots.txt (§7), so crawlers do not spend time on
  combinations. Render facet links with `rel="nofollow"`.
- **Category description text.** Under the H1, show 1–2 sentences built from real data (product count, price
  range, product types: the same facts as `categoryMetaDescription`). Below the grid, show a 100–250-word intro
  written by the owner.
  - That intro needs a `categories.description` column (`ALTER TABLE categories ADD COLUMN description TEXT`)
    and a field in Admin › Kategoriler. This is the owner's decision; no migration is done here.
  - No keyword stuffing and no invented claims.

## 7. robots.txt (`app/robots.ts`)

- `/_next/` is **not** blocked any more. Google has to load JS/CSS to render the pages.
- `Disallow: /api/` stays, except:
  - `/api/feeds/google` (Merchant)
  - `/api/images/` (stored image URLs, favicon)
  - the read-only storefront GETs that client components still fetch while rendering: products,
    product-page-data, categories, site-settings, homepage-sections, hero (`/api/hero/`, the home page hero) and hero-slides, shipping-settings, pages, menus
  The longest matching rule wins, so these Allow lines win over `/api/`. `next.config.ts` also sends
  `X-Robots-Tag: noindex` on every `/api/*` response except `/api/images/*` and `/api/feeds/*`, so JSON responses
  are never indexed.
- Disallowed:
  - `/admin/`, `/odeme/`, `/profile/`, `/orders/`, `/login/`, `/register/`, `/siparis-basarili/`,
    `/siparis-hata/`, `/degerlendir/` (personal review links), `/maintenance/`
  - `/cart?`, `/cart/`, `/checkout?`, `/checkout/`. These are the legacy links inside the hidden Akakçe block;
    the routes do not exist.
  - search, filter and sort parameters (`/*?q=`, `/*&q=`, `/*?f=`, …)
- The private pages also send `noindex` (`privatePageMetadata`). Google cannot see that tag on a disallowed URL,
  but none of them is indexed or linked from outside today, so blocking the crawl is the stronger guarantee.
- One group for `*` and `Googlebot` (when a Googlebot group exists, Googlebot ignores `*`).
- `Sitemap: https://onopostore.com/sitemap.xml` (apex).
- www serves the same file (worker.ts does not redirect `/robots.txt`); www pages 301 to the apex.

## 8. Sitemap (`app/sitemap.ts`, https://onopostore.com/sitemap.xml)

- Contents:
  - `/` and `/products/`, lastmod = newest product change (never "now")
  - `/kategori/<slug>/` for categories with ≥ 1 active product, lastmod = newest product change in the category
  - **every active product, in stock or not**, at `/<slug>/`, lastmod = `updated_at`, else `created_at`
  - CMS pages at `/page/<slug>/`, lastmod = `pages.updated_at`
  - `/rehber/` and every guide at `/rehber/<slug>/`, lastmod = the guide's `dateModified` (`guideSitemapEntries()`)
  - `/cihaz/` and every device page with an in-stock product, lastmod = newest product change on the page
    (`deviceSitemapEntries()`)
- No utility pages and no query strings.
- Same XML shape as before (`<url><loc><lastmod><changefreq><priority>`), because Akakçe reads it.
- Image entries are implemented but switched off (`INCLUDE_IMAGES`).
- On a DB error it answers 500 (crawlers retry) instead of a one-URL sitemap.
- Served on both apex and www without a redirect (Akakçe reads the www URL).
- The regression harness check for new sitemap URLs must allow `/kategori/<slug>/` and `/page/<slug>/`
  (two path segments).

## 9. Akakçe crawl contract (do not break)

Akakçe has no feed integration. Its bot ("akakce bot") reads `https://www.onopostore.com/sitemap.xml` and fetches
every `https://onopostore.com/<slug>/` about every 2 hours. It parses the **Product JSON-LD** and the hidden
**`#product-info`** block from the **server HTML**. Both must be rendered on the server, on the product URL itself
(no redirect), with exactly these formats. `components/seo/ProductMachineData.tsx` renders them
(`productJsonLd` and `productInfoHtml` in `lib/seo.ts`). `scripts/seo.test.mjs` checks the hidden block markup
and the brand.

Live markup, captured 2026-10-22 (before the redesign) from
`https://onopostore.com/onopo-t67-usb-a-to-type-c-67w-turbo-sarj-ve-data-kablosu-hizli-guclu-ve-dayanikli/`
(rendered in `<body>`, before the page content):

```html
<script type="application/ld+json">{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu – Hızlı, Güçlü ve Dayanıklı",
  "description": "67W Type-C Şarj ve Data Kablosu Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu, güçlü ve güvenilir şarj deneyimi sunar.GaN teknolojisi … (stripHtml(description, 500), ends with "..." when cut)",
  "image": [
    "https://images.onopostore.com/1770234125156-ONOPOT67.png"
  ],
  "sku": "T67",
  "brand": {
    "@type": "Brand",
    "name": "ONOPO"
  },
  "url": "https://onopostore.com/onopo-t67-usb-a-to-type-c-67w-turbo-sarj-ve-data-kablosu-hizli-guclu-ve-dayanikli/",
  "offers": {
    "@type": "Offer",
    "url": "https://onopostore.com/onopo-t67-usb-a-to-type-c-67w-turbo-sarj-ve-data-kablosu-hizli-guclu-ve-dayanikli/",
    "priceCurrency": "TRY",
    "price": "129.99",
    "priceValidUntil": "2026-11-20",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Onopo Store"
    }
  },
  "category": "Cep Telefonu Aksesuarları"
}</script>
<div id="product-info" style="display:none">
  <h1 id="product-name">Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu – Hızlı, Güçlü ve Dayanıklı</h1>
  <span id="product-price">129,99 ₺</span>
  <span id="product-original-price">169,99 ₺</span>
  <span id="product-sku">T67</span>
  <span id="product-stock">Stokta</span>
  <span id="product-category">Cep Telefonu Aksesuarları</span>
  <img id="product-image-1" src="https://images.onopostore.com/1770234125156-ONOPOT67.png" alt="Onopo T67 USB-A to Type-C 67W Turbo Şarj ve Data Kablosu – Hızlı, Güçlü ve Dayanıklı" />
  <a id="add-to-cart" href="/cart?add=1058">Sepete Ekle</a>
  <a id="buy-now" href="/checkout?product=1058">Hemen Al</a>
</div>
```

Contract details:

- **JSON-LD:**
  - pretty-printed with 2 spaces
  - `price` is a string with 2 decimals = `roundPrice(price)` (what checkout charges)
  - `sku` = `product_code` or `ONOPO-<id>` when empty
  - `image[]` = all images as absolute images.onopostore.com URLs, in stored order
  - `availability` = InStock if stock > 0, else OutOfStock
  - `url` = canonical with a trailing slash
  - `category` = `products.category` (the name)
- **Hidden block:**
  - each element on its own line, indented with 2 spaces
  - `#product-name`: name HTML-escaped (`& < > "`)
  - `#product-price`: tr-TR format with 2 decimals plus `" ₺"`, e.g. `1.499,99 ₺`
  - `#product-original-price`: only when rounded original > rounded price
  - `#product-sku`: as in the JSON-LD
  - `#product-stock`: `Stokta` / `Tükendi`
  - `#product-category`
  - `#product-image-1..N`: same URLs as the JSON-LD, `alt` = name, then ` loading="lazy"` as the last
    attribute (see below)
  - the two legacy anchors `#add-to-cart` and `#buy-now`. They are kept verbatim; robots.txt blocks their
    targets and the routes return 404.
- **Changes since the capture above:**
  - Hidden block: the **only** allowed change is ` loading="lazy"`, appended as the last attribute of every
    `<img id="product-image-N">`, so each tag now ends `alt="…" loading="lazy" />`. Ids, `src`, `alt`, order and
    all other markup stay byte-identical. Why: the block is `display:none`, but browsers still downloaded every
    full-size original in it on each product view (several MB per page, over 20 MB on the heaviest one). Akakçe
    reads `src` from the server HTML, so lazy loading does not affect it.
  - JSON-LD: `brand.name` stays `"ONOPO"`. New keys come after the existing ones: `offers.itemCondition`,
    `offers.shippingDetails`, `offers.hasMerchantReturnPolicy` (inside `offers`, after `seller`), then `mpn`,
    `gtin*`, `aggregateRating` and `review` (only from real reviews) after `category`.
  - Every existing key keeps its value, order and format.
- Also part of the contract:
  - product URLs `/<slug>/` with the trailing slash, answering 200 without a redirect
  - `sitemap.xml` at the same URL, listing them
  - out-of-stock products stay reachable (200, `Tükendi` / OutOfStock) so Akakçe can update their status
  - inactive products answer 404 so they are delisted
- **Regression checks** (integration audit, checklist items 11 and 12): on 3 random sitemap product URLs, the
  page must:
  - return 200 without a redirect
  - contain `application/ld+json` with `"@type": "Product"` and `"price"`
  - contain the ids `product-name`, `product-price`, `product-sku`, `product-stock` and `product-image-1`
  - show a `#product-price` text equal to the JSON-LD price formatted tr-TR + " ₺"

## 10. Open items for the owner (not code)

- `site_settings.instagram_url` points to another shop's account (`gulergozluksaat`). It is left out of `sameAs`;
  fix it in Admin › Ayarlar. The admin form's default was `instagram.com/onopostorecom`.
- The footer address (`footer_address`) and the address on the CMS help page differ. Choose one. No address is
  put in structured data until they match.
- Brand assets:
  - `og-image.jpg` should be re-made at 1200×630, under 300 KB, in the real brand colours
  - there is no `public/apple-touch-icon.png` (180×180); the layout uses the admin favicon (`favicon_url`) as
    the apple icon when one is set
- **Before launch:** rename the category slug "ok-satanlar" (Çok Satanlar, made by the old broken slugifier) to
  "cok-satanlar": back up D1, run `UPDATE categories SET slug='cok-satanlar' WHERE slug='ok-satanlar'`, deploy.
  `/ok-satanlar/`, `/kategori/ok-satanlar/` and `?category=ok-satanlar` then 308 automatically
  (`CATEGORY_SLUG_ALIASES` in `lib/seo.ts`). New categories already get Turkish-safe slugs
  (`POST /api/categories` uses `slugifyTr()`); renaming a category in the admin keeps its slug.
- Product 1107 (Samsung S24 Ultra screen protector): its description names the wrong model ("Samsung S24 Plus").
  The meta description now starts with the right model, which makes the mismatch visible. Correct the text in
  Admin › Ürünler.
- Legal pages (Mesafeli Satış Sözleşmesi, Ön Bilgilendirme Formu, KVKK, Çerez Politikası) do not exist. Create
  them as CMS pages; they then appear in the sitemap automatically.
- Cloudflare (owner): the www/http → apex redirect is done in `worker.ts` (§1), so no Redirect Rule is needed.
  If one is ever added, it runs before the Worker and needs the same exclusions. Always Use HTTPS (the Worker
  leaves `/api/*` on http alone). HSTS is sent by the site itself (`Strict-Transport-Security: max-age=31536000`,
  no includeSubDomains, no preload: worker.ts `withHsts`, static assets via `public/_headers`); do not also switch
  it on in the Cloudflare SSL/TLS settings with includeSubDomains (printfast.onopostore.com is another service).
- The regression harness (`onopo-tasarim-yedek/regresyon`, `sitemapAdditionKind`) must allow the new sitemap URLs
  `/rehber/`, `/rehber/<slug>/`, `/cihaz/` and `/cihaz/<slug>/`, or it warns about them as unexpected additions.

## 11. Google Merchant feed (`/api/feeds/google`, items in `lib/google-feed.ts`)

- Every **active** product, sold-out ones too with `g:availability` `out_of_stock` (they used to be left out).
- `g:image_link` = first image, `g:additional_image_link` = up to 10 more; all original, absolute URLs.
- `g:gtin` only for a valid GS1 barcode (`products.gtin`), `g:mpn` = `product_code`, `g:identifier_exists no` only
  when there is neither.
- `g:product_type` = category > product type ("Cep Telefonu Aksesuarları > Şarj ve Data Kablosu"); a selection
  category ("Çok Satanlar") is dropped. `g:google_product_category` = numeric id from Google's taxonomy (version
  2021-09-21) for unambiguous types only (screen protectors 5468, chargers/car chargers/power banks 505295, cables 259,
  aux cables 1867, headphones 543626, vacuums 619, vacuum parts 618, printers 500106, game controllers 301, game
  adapters 8008); left out otherwise. Rules: `classifyProduct()`; tests: `node --test scripts/feeds.test.mjs`.
- No `g:product_highlight`/`g:product_detail`: `ai_product_facts` is AI-written free text, not reliable enough.
- Akakçe's XML feed (`/api/feeds/akakce`) fills `<barkod>` from `products.gtin` first, then the spec table.

## 12. Shopping guides (`/rehber/`)

- Content lives in code: `lib/guides/content/*.ts` (typed `Guide`: slug, title ≤ 52, description 140–160, intro,
  datePublished/dateModified, sections of H2 + paragraphs/lists/tips, FAQ, related-products rule). Inline links are
  written `[label](/rehber/<slug>/)`. The slug list is `lib/guides/slugs.ts` (also read by `lib/redirects.ts`).
  Change `dateModified` whenever a text changes (Article JSON-LD and sitemap lastmod).
- Related products come live from D1 (`lib/guides/server.ts` → `getActiveProducts()` → `selectGuideProducts`):
  clauses of FACETS keys and/or a search query on the product NAME, taken in turns, in stock first, max 8. Never
  prices or stock in the text. If the catalogue cannot be read the page renders without them and carries
  `data-onopo-nocache`.
- Pictures: only our own product photos (R2), never stock or generated images. `selectGuideImages` takes the first 3
  in-stock related products with a photo, in the product row's order (`lib/guides/server.ts` `getGuideImages`, the same
  catalogue read). They are the guide's header picture (`components/guides/GuideArt.tsx`: white tiles on a light panel,
  fixed aspect ratio, alt = the product's short name), the guide cards' pictures (hub, "Diğer rehberler"; lazy except the
  hub's first card), a small photo in the compact lists (`/kategoriler/`, device pages), og:image (the originals on
  images.onopostore.com; the hub uses the first guide's) and the Article JSON-LD `image`. A guide without such a product
  shows its icon and the site og-image. A failed catalogue read leaves the pictures out and marks the page
  `data-onopo-nocache`.
- Product pages show one "İlgili rehber" link: `guideForProduct()` tries the guides in `PRODUCT_GUIDE_ORDER`
  (most specific first) with each guide's `productMatch` (default: its product clauses).
- Internal links: footer "Rehberler" (Müşteri hizmetleri column), the "Alışveriş rehberleri" block on
  `/kategoriler/`, the product page link, "Diğer rehberler" under each guide.
- Edge cache: `/rehber/` and `/rehber/<slug>/` are on the allowlist. Old-URL resolver: both are live targets;
  `/rehber/<slug>.html` and `/<guide-slug>/` 301 to the guide; any other path under `/rehber/` stays a 404 (no
  fuzzy match to a product).
- Tests: `node --test scripts/guides.test.mjs` (data, rules against `scripts/fixtures/guide-catalog.json` = the
  active products' public names, sitemap, edge cache, redirects).

## 13. IndexNow, /llms.txt and the product FAQ

**IndexNow** (`lib/indexnow.ts`, admin hooks in `lib/indexnow-server.ts`, https://www.indexnow.org/documentation).
One POST to `https://api.indexnow.org/indexnow` reaches Bing, Yandex, Seznam, Naver …; ChatGPT search reads Bing.

- Key: `INDEXNOW_KEY` in `wrangler.toml` `[vars]` (public by design). `worker.ts` answers `/<key>.txt` with exactly
  the key (`text/plain`) before the edge cache and the old-URL resolver; www 301s to the apex like any page. An empty
  or invalid key switches IndexNow off.
- Body: `{ host: 'onopostore.com', key, keyLocation: 'https://onopostore.com/<key>.txt', urlList }`. Only canonical
  `https://onopostore.com/…/` URLs (trailing slash, no query; no `/api`, `/admin`, files), de-duplicated, ≤ 10 000.
- Admin saves (one POST per save, in `ctx.waitUntil`): product create (page, category listing, `/products/`), product
  save (page, its listing and the listing it left), product delete (page, listing, `/products/`), bulk import, category
  rename (its listing) and delete, CMS page save. Variation saves are not sent separately (they belong to the same save).
- Daily cron (`/api/cron/automation/?job=indexnow`): `app/sitemap.ts` is the list. Sent: URLs never sent, URLs whose
  `lastmod` is newer than their last submission, and URLs that left the sitemap (their row is then dropped). What was
  sent is in D1 `indexnow_urls (url, submitted_at)`; admin saves record theirs too, so the cron does not repeat them.
  Pages added to the sitemap later (guides, device pages) are sent once by themselves; the first run sends the whole
  sitemap once.
- Off unless the key is valid, the host is onopostore.com / www and `NODE_ENV` is not development. Never throws; a
  refused (4xx/5xx) or failed POST is a system-log row (source `indexnow`, de-duplicated per day). 200 and 202 count as
  accepted. The USD price cron does not touch `updated_at`, so exchange-rate price changes are not sent.

**`/llms.txt`** (https://llmstxt.org; `app/llms.txt/route.ts`, text in `lib/llms-txt.ts`): H1 store name, a blockquote
summary (product types from the catalogue), the store facts (shipping rule from `shipping_settings`, handling days and
return window from the CMS shipping page, card payment and max installments, contact from `site_settings`; each left
out when its data is missing), then link sections: categories with product counts, the guides, "Cihaza göre" (the
indexable device pages with counts, §14), the 30 most viewed in-stock products with the price checkout charges, the CMS
pages, and an "Optional" section (all products, sitemap). Edge-cached like the sitemap (cache_version); 500 on a
catalogue read failure. Allowed by the robots `/` rule; not in the sitemap.

**Product FAQ** (`lib/product-faq.ts`, `components/pdp/ProductFaq.tsx`): a "Sık sorulan sorular" block between the
details and the reviews, native `<details>` rows (no client JS), 4–6 questions from real data only: compatibility
(only when the product name itself lists the device model(s); the answer repeats them), stock (live flag, no
quantity), handling (the page's own delivery line when the product or the store setting has one, so the two
never disagree; else the CMS days), shipping cost (settings + the product's free-shipping flag / price), returns, payment and
installments. A question whose data is missing is left out. The FAQPage JSON-LD carries exactly the visible items.
Tests: `node --test scripts/indexnow.test.mjs scripts/product-faq.test.mjs`.
## 14. Device pages (`/cihaz/`)

- Pages come from the ACTIVE product names, not from a list in code: `lib/devices/match.ts` (`buildDeviceCatalog`).
  Brands: iPhone, Samsung (phones), Xiaomi ve Redmi, Infinix, iPad, Samsung Galaxy Tab (Tab and SM-T/SM-P codes),
  Huawei (MediaPad/MatePad). A brand or model gets a page with at least `MIN_DEVICE_PRODUCTS` (3) products; a smaller
  model is only listed on its brand page (search link, nofollow), a smaller brand only on the hub.
- A product names a model when the brand/series word is followed by it; the next word must not make it another model
  ("iPhone 15" is not "iPhone 15 Pro", "Redmi Note 12" is not "12 Pro" or "12S"); a list names each model ("iPhone 13 /
  13 Pro"). Screen sizes and numbers with units are never models. A brand: its brand word, or Lightning for iPhone.
- Connector rules only where the port is certain: iPhone up to 14 (and SE/X/XR/XS) Lightning, iPhone 15+ and Galaxy S8+
  USB-C. Chargers, cables and car chargers (`lib/product-type.ts`) whose name has that connector as the phone plug and
  no other phone connector are listed on those model pages, and the intro says why. A charger whose Type-C is its own
  port ("Girişli", "Çıkışlı", "Başlığı", "Adaptör") is not: it needs a separate cable and fits a Lightning iPhone too.
  Android brands as a whole get no rule.
- Page: H1 "<label> aksesuarları", 2–3 sentences from real counts and types (no prices, no promises), breadcrumbs, models
  (brand pages), products grouped by type (ekran koruyucu, şarj aleti, kablo, araç şarjı, powerbank, diğer; in stock
  first; compact `ProductCard`), sibling models, related guides (`guideForProduct` tally). Title: label + product types
  (≤ 52); description: `categoryMetaDescription`.
- Indexable (`isIndexableDevicePage`; sitemap, llms.txt, IndexNow, hub ItemList): at least one in-stock product, and on a
  model page at least 3 products whose NAME names the model. Otherwise noindex,follow (200), out of the sitemap. A model
  page filled by the connector rule is nearly the same list on every model with that port (iPhone 15 … 16 Pro Max share
  ~18 USB-C products and differ by 2 protectors): useful from the product page, near-duplicates for a search engine.
  Today (2026-10-22) no model reaches 3 named products, so only the 5 brand pages and the hub are indexed.
- Product pages link one device page ("Bu cihaz için diğer ürünler"): the single model page the name names, else the
  single brand page; connector rules never pick a page. `/kategoriler/` has a "Cihaza göre" block (brand pages).
- Edge cache: `/cihaz/` and `/cihaz/<slug>/` are on the allowlist (admin writes bump `cache_version` as usual). Old-URL
  resolver: both are live targets (same rules on the index's product names); `/cihaz/<slug>.html` → the page; any other
  path under `/cihaz/` stays a 404 (no fuzzy match to a product). `cihaz` is a reserved slug everywhere.
- URL list for other consumers: `devicePagePaths(products)` (pure) or `getDevicePageUrls()` (server, absolute).
  `/llms.txt` lists the same pages ("Cihaza göre", `deviceLlmsLinks`); IndexNow's daily sweep gets them from the
  sitemap. Tests: `node --test scripts/devices.test.mjs` (rules on `scripts/fixtures/guide-catalog.json`).
