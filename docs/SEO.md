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
| Category | `/kategori/<category-slug>/` | `categoryPath(slug)` | New route (wave 2). `/products/?category=<name or slug>` → 308 here |
| Product | `/<product-slug>/` | `productPath(slug)` | **Never change this format.** Akakçe, both feeds, the sitemap and JSON-LD use it |
| CMS page | `/page/<slug>/` | `cmsPagePath(slug)` | help, shipping, policy, terms, and any page added in Admin › Sayfalar |
| `/product/<id>/` | → 308 `/<slug>/` | `resolveProductId(id)` | 404 for unknown or inactive ids |
| `/help/ /policy/ /shipping/ /terms/` | → 308 `/page/<slug>/` | `LEGACY_PATH_REDIRECTS` | The static copies contain placeholder contacts (destek@onopo.com, 0850 …) |
| `/tech/ /beauty/ /new/` | → 308 `/products/` | `LEGACY_CATEGORY_TARGETS` | Legacy hard-coded listings; 0 products. `/new/` = newest first = the default order of `/products/` |
| `/gaming/` | → 308 `/kategori/oyun-ve-oyuncu-aksesuarlari/` | | Falls back to `/products/` if that category has no active product |
| `/sepet`, `/uye-giris` | → 308 `/odeme/`, `/login/` | | URLs from the old shop platform |
| Utility pages | (no canonical, noindex) | `privatePageMetadata` | `/odeme/ /profile/ /orders/ /login/ /register/ /siparis-basarili/ /siparis-hata/ /maintenance/ /admin/*` |

**Why `/page/<slug>/` for CMS pages.** The footer already links there, and it is a namespace of its own: a new
CMS page can never collide with a product slug at the root. Delete the hard-coded `app/help`, `app/policy`,
`app/shipping` and `app/terms` routes (their contacts are wrong). Then `/help/` reaches `app/[slug]`, and
`resolveSlug('help')` returns `{ kind: 'page', path: '/page/help/' }`, which becomes a 308. Alternatively,
add `LEGACY_PATH_REDIRECTS` to `next.config.ts` `redirects()`. With `trailingSlash: true`, confirm with curl
that both `/help` and `/help/` redirect.

**Reserved slugs.** `RESERVED_SLUGS` lists the top-level static routes. A product with one of these slugs would
be shadowed, so the product slug generator (`app/api/products/route.ts`) should reject them. No product uses one
today.

**www and http.** The owner adds the redirect in Cloudflare (a Redirect Rule, not Next middleware). Pages
redirect www → apex with a 301. Exclude `/api/*`, or use a 308 for it: checkout POSTs happen on www, and PayTR and
BirFatura call the apex. Also exclude `/sitemap.xml` and `/robots.txt`, or check that the Akakçe bot follows the
redirect, because it reads `https://www.onopostore.com/sitemap.xml`. Canonicals already point at the apex
whichever host served the page.

## 2. Metadata (`<head>`)

### Root layout (`app/layout.tsx`, owned by the layout agent)

- Use `export const metadata = rootMetadata` from `lib/seo.ts`. It sets:
  - `metadataBase`
  - the title template `%s | Onopo` and the default title and description
  - Open Graph and Twitter defaults with the existing **`/og-image.jpg`** (1024×1024)
  - robots `index,follow` with `max-image-preview:large`
- **Delete** these from the layout:
  - the hard-coded `<link rel="canonical" href={baseUrl}>`, which made every page canonical to the home page
  - the `verification.google` placeholder (Search Console is verified by DNS)
  - the two feed `<link rel="alternate">` tags (one has the wrong type)
  - the Google Fonts preconnects (next/font hosts the fonts itself)
- `/og-image.png` does not exist; nothing may reference it. The fallback is `DEFAULT_OG_IMAGE` (`/og-image.jpg`).
- Organization and WebSite JSON-LD: render `organizationJsonLd(site)` and `websiteJsonLd(site)` with
  `<JsonLd>`, where `site = await getSiteSeo()`, either in the root layout or on the home page, but not in both.
  - They replace the old placeholder blocks: phone `+90-XXX-XXX-XXXX`, wrong `sameAs`, and `?search=` in the
    SearchAction.
  - `sameAs` contains only real brand profiles from `site_settings`.
  - `contactPoint` is added only when `footer_phone` is set.

### Every page

```ts
import { buildMetadata, getSiteSeo } from '@/lib/seo'

export async function generateMetadata(): Promise<Metadata> {
    const site = await getSiteSeo()
    return buildMetadata({
        title: '…',            // without the brand; the template adds " | Onopo"
        description: '…',      // 140–160 chars, Turkish, built from real data (helpers below)
        path: '/kategori/x/',   // canonical path; trailing slash is added if missing
        query: { page },        // only on listings; page 1 is dropped automatically
        images: [product.images[0]],  // optional; '/api/images/<key>' is resolved to https://images.onopostore.com/<key>
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
| Category | `categoryTitle(name, page)` → "Cep Telefonu Aksesuarları Modelleri ve Fiyatları" (page ≥ 2: "… Fiyatları - Sayfa 2") |
| /products/ | "Tüm Ürünler" (page ≥ 2: "Tüm Ürünler - Sayfa N"); search: `«${q}» için arama sonuçları` (noindex) |
| CMS page | `page.title` from the pages table ("Kargo ve İade") |
| Utility | a plain title ("Sepetim", "Giriş Yap") + `privatePageMetadata` |

`cleanTitle()` strips old suffixes such as "- ONOPO" and "| Onopo Store" that the template would duplicate.

### Descriptions (Turkish, 140–160 characters, from real data)

| Page | Helper |
|---|---|
| Product | `productMetaDescription(product, site)`. It takes the first real sentence(s) of the description body (the repeated name, category label, emoji and spec table are removed) and adds facts from the settings: "Kargo bedava" or "500 TL üzeri kargo bedava", "14 gün iade", "güvenli ödeme", plus "Şu an stokta yok." when stock ≤ 0. |
| Category | `categoryMetaDescription(name, { count, minPrice, productNames }, site, page)` → "Cep Telefonu Aksesuarları: 109 ürün, 79,99 TL'den başlayan fiyatlarla. Ekran koruyucular, …" |
| /products/ | `listingMetaDescription({ count, minPrice, productNames }, site, { query, page })` |
| Home | `homeMetaDescription(productNames, site)` |
| CMS | `cmsPageDescription(title, content)` |

The facts are not hard-coded. The free-shipping threshold comes from `shipping_settings`, and the 14-day return
from the CMS "shipping" page text. If the owner edits either, the descriptions and JSON-LD follow within 5 minutes
(`getSiteSeo()` cache).

## 3. Headings, breadcrumbs, internal links, images

- **One visible `<h1>` per page.**
  - Home: a real H1, e.g. "Hızlı Şarj Aletleri, Kablolar ve Ekran Koruyucular". Today the home page has none.
  - Category: the category name.
  - /products/: "Tüm Ürünler", or «"q" için sonuçlar» for a search.
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
| Home (or layout) | `organizationJsonLd(site)` (OnlineStore, with the return policy) + `websiteJsonLd(site)` (SearchAction → `/products/?q={search_term_string}`) |
| Product | `<ProductMachineData product={row} site={site} reviews={{ count, average }} />` + `breadcrumbJsonLd([...])` |
| Category | `breadcrumbJsonLd` + `itemListJsonLd(productsOnThisPage.map(p => ({ path: productPath(p.slug), name: p.name })), { startIndex })` |
| /products/ (page 1, no filters) | `itemListJsonLd(...)` (optional) |
| CMS | `breadcrumbJsonLd` |

`productJsonLd` (used by `ProductMachineData`) builds the following, from real data only:

- name, description, absolute `image[]`
- `sku` = product_code or `ONOPO-<id>`, and `mpn` = product_code when set
- brand:
  - "Onopo" when the name or description starts with onopo, or the spec table says "Marka Onopo"
  - otherwise the spec-table brand (e.g. "Ally")
  - otherwise no brand
- `gtin13` only for a barcode in the spec table with a valid check digit (2 products today)
- offers:
  - `price` = `roundPrice(price).toFixed(2)`, the exact amount checkout charges
  - `priceCurrency` TRY
  - `availability` InStock/OutOfStock from stock
  - `itemCondition` NewCondition
  - `seller`
- `shippingDetails` (TR):
  - rate 0 when `free_shipping=1` or the price ≥ the `shipping_settings` threshold, otherwise the real shipping cost
  - `deliveryTime` is left out until the owner gives a real carrier transit time (`SiteSeo.transitTime`)
- `hasMerchantReturnPolicy` (TR, 14 days, by mail, free return with the contracted carrier). It comes from the CMS
  "shipping" page and is left out if that text no longer states a return window.
- `aggregateRating` only when the product has reviews (pass `{ count, average }` from the `reviews` table). Never
  invent ratings.

Validate with Google's Rich Results Test after deploy.

## 5. Soft 404s → real 404s and redirects

Today unknown slugs, `/product/999999/`, `/page/yok/`, `/cart/` and missing files (`/og-image.png`,
`/apple-touch-icon.png`, `/manifest.json`) all answer 200. Use the resolvers. Each one returns what to do, or
`null` for a real 404. Use the `…Cached` variants (React `cache`) so `generateMetadata` and the page share one
DB lookup.

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
  `/kategori/cep-telefonu-aksesuarlari/`, `/tech/` → 308 `/products/`.

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
| `?f=`, `?sort=`, `?minPrice=`, `?maxPrice=`, `?brand=` | noindex, follow | none |
| `?category=` that did not redirect (unknown/empty category) | noindex, follow | none |
| `utm_*`, `gclid`, … | ignored | self without them |

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
  The longest matching rule wins, so these Allow lines win over `/api/`. Ask the `next.config.ts` owner to add
  `X-Robots-Tag: noindex` on `/api/:path*` so JSON responses are never indexed. Change only that header there,
  and never Cache-Control.
- Disallowed:
  - `/admin/`, `/odeme/`, `/profile/`, `/orders/`, `/login/`, `/register/`, `/siparis-basarili/`,
    `/siparis-hata/`, `/maintenance/`
  - `/cart?`, `/cart/`, `/checkout?`, `/checkout/`. These are the legacy links inside the hidden Akakçe block;
    the routes do not exist.
  - search, filter and sort parameters (`/*?q=`, `/*&q=`, `/*?f=`, …)
- The private pages also send `noindex` (`privatePageMetadata`). Google cannot see that tag on a disallowed URL,
  but none of them is indexed or linked from outside today, so blocking the crawl is the stronger guarantee.
- One group for `*` and `Googlebot` (when a Googlebot group exists, Googlebot ignores `*`).
- `Sitemap: https://onopostore.com/sitemap.xml` (apex).
- www serves the same file. Once www pages 301 to the apex, the rules are identical anyway.

## 8. Sitemap (`app/sitemap.ts`, https://onopostore.com/sitemap.xml)

- Contents:
  - `/` and `/products/`, lastmod = newest product change (never "now")
  - `/kategori/<slug>/` for categories with ≥ 1 active product, lastmod = newest product change in the category
  - **every active product, in stock or not**, at `/<slug>/`, lastmod = `updated_at`, else `created_at`
  - CMS pages at `/page/<slug>/`, lastmod = `pages.updated_at`
- No utility pages and no query strings.
- Same XML shape as before (`<url><loc><lastmod><changefreq><priority>`), because Akakçe reads it.
- Image entries are implemented but switched off (`INCLUDE_IMAGES`).
- On a DB error it answers 500 (crawlers retry) instead of a one-URL sitemap.
- Until the `/kategori/[slug]` route exists, the category URLs in the sitemap return 404.
- The regression harness check for new sitemap URLs must allow `/kategori/<slug>/` and `/page/<slug>/`
  (two path segments).

## 9. Akakçe crawl contract (do not break)

Akakçe has no feed integration. Its bot ("akakce bot") reads `https://www.onopostore.com/sitemap.xml` and fetches
every `https://onopostore.com/<slug>/` about every 2 hours. It parses the **Product JSON-LD** and the hidden
**`#product-info`** block from the **server HTML**. Both must be rendered on the server, on the product URL itself
(no redirect), with exactly these formats. `components/seo/ProductMachineData.tsx` renders them byte-identically
to today. Unit tests compare its output with the live HTML of products 1058 and 1028.

Live markup, captured 2026-10-22 from
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
  - `#product-image-1..N`: same URLs as the JSON-LD, `alt` = name
  - the two legacy anchors `#add-to-cart` and `#buy-now`. They are kept verbatim; robots.txt blocks their
    targets and the routes return 404.
- **Changes from today** (all additive, or a case change):
  - `brand.name` is "Onopo" instead of "ONOPO". A third-party product gets its own brand ("Ally"); a product
    with no brand information gets no brand (1 product).
  - New keys after the existing ones: `offers.itemCondition`, `offers.shippingDetails`,
    `offers.hasMerchantReturnPolicy`, `mpn`, `gtin13`, `aggregateRating`.
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
- Carrier transit time (days) is needed for `deliveryTime` in the Product JSON-LD. Handling time is "1-3 iş
  günü" from the CMS shipping page. The home page says "Saat 18:00'e kadar aynı gün kargo"; align the two texts.
- The footer address (`footer_address`) and the address on the CMS help page differ. Choose one. No address is
  put in structured data until they match.
- Brand assets:
  - `og-image.jpg` should be re-made at 1200×630, under 300 KB, in the real brand colours
  - `public/apple-touch-icon.png` (180×180) is missing, but the layout links it
- Category slug "ok-satanlar" (Çok Satanlar) has the broken-slugifier bug. Renaming it to "cok-satanlar" needs a
  308 from the old slug. The admin category slugifier should use `slugifyTr()` from `lib/seo.ts`.
- Legal pages (Mesafeli Satış Sözleşmesi, Ön Bilgilendirme Formu, KVKK, Çerez Politikası) do not exist. Create
  them as CMS pages; they then appear in the sitemap automatically.
- Cloudflare (owner): www→apex Redirect Rule with the exclusions in §1, Always Use HTTPS, and HSTS later without
  includeSubDomains.
