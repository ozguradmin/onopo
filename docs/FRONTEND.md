# Storefront frontend foundation

What the storefront is built on (the wave-1 foundation, updated for the redesign). Read this before
touching pages, the header/footer, the listing, the product page or the checkout styling. The visual
direction is the design spec v1 (audit `tasarim-referans.md` → "Extra"); this file is the code contract.

Rules of thumb:

- Pages are **Server Components** that read data through `lib/catalog.ts`. Client components are
  small islands (cart, search box, favourites, filters, gallery). No page fetches its own data
  from `/api/*` in `useEffect` any more.
- Never fetch `/api/site-settings`, `/api/categories`, `/api/menus` or `/api/shipping-settings`
  from the browser. Use the store-data hooks instead (see "Layout and shell").
- No full-page spinners and no "Yükleniyor..." text. Skeletons only for in-page async parts.
- Never reload the page from code. No `window.location.reload()` and no `window.location.href = …`
  for internal navigation. Use `<Link>` or `router.push`. The one exception is the guarded reload after
  a JS chunk failed to load (see "Errors" below).
- Never put per-user output into server HTML: the edge cache (worker.ts) shares anonymous HTML between
  visitors. Decide per-user UI on the client (see "Session hint").
- Keep all `/api/*` contracts (see `CLAUDE.md` and the audit `entegrasyonlar.md`).

---

## 1. Layout and shell

`app/layout.tsx` is a server component, and it is the only place that loads layout data:

```
RootLayout (server)            getStorefrontData(): settings, shipping, maxInstallments, categories, menus
 │                             getSiteSeo() → Organization + WebSite JSON-LD
 ├ GlobalErrorBoundary (root)  last-resort fallback
 │  └ LayoutProvider (client)  components/layout/LayoutProvider.tsx
 │     ├ StoreDataProvider     context with the server data
 │     ├ skip link, Header (TopBar + sticky header)     ┐
 │     ├ CartDrawer, MobileMenu                          │ store chrome (see "Chrome by path")
 │     ├ <main id="main-content">                       │
 │     │   └ GlobalErrorBoundary (page, resets on navigation) → {children}
 │     ├ Footer                                          │
 │     └ MobileNav (bottom nav)                          ┘
 └ Toaster (sonner)
```

- `export const dynamic = 'force-dynamic'` in the root layout: every page is rendered per request
  with live data. No page is prerendered with build-time defaults.
- **Chrome by path.**
  - `/admin/*` and `/maintenance` get no store header or footer. Admin keeps its own
    `app/admin/layout.tsx`.
  - `/odeme` gets the reduced checkout header and footer (`variant="checkout"`), no MobileMenu and no
    bottom nav.
  - `/siparis-basarili` and `/siparis-hata` (PayTR's result pages, shown inside the payment iframe on
    `/odeme`) render without any store chrome: no skip link, header, drawers, footer or bottom nav.
    `<main>` gets `min-h-dvh bg-surface`, and every link on them has `target="_top"` in the server
    HTML. Page views are still counted.
- **Bottom nav (MobileNav).** Not rendered on `/odeme`, `/siparis-basarili` and `/siparis-hata`
  (LayoutProvider skips it, and MobileNav also returns null on those paths). Any page can hide it by
  rendering an element with `data-hide-bottom-nav` (`app/globals.css`: `display: none`, so its links
  also leave the tab order). The product page's sticky buy bar does this, so an in-stock product page
  shows no bottom nav. On phones, store pages with no bottom nav at all drop the body's 64 px bottom
  padding; pages that only hide it keep it for their own bar. Bottom toasts are lifted above the
  bottom nav and above a visible buy bar.
- **Maintenance mode** (`site_settings.maintenance_mode`) is checked from server data. When it is on,
  every path except `/admin/*`, `/maintenance`, `/login` and `/register` renders a maintenance
  message in the server HTML. API routes are never affected. The maintenance render carries
  `data-onopo-nocache=""` and `data-onopo-maintenance=""`; worker.ts answers it with 503,
  `Retry-After` and `X-Robots-Tag: noindex`. Any other maintenance view must keep both markers.
- **The element around the page never changes type**, so pages mount exactly once. There is no mount
  gate and no remount.
- **Cart.** The shell rehydrates the store once on mount (`skipHydration`), then follows the saved cart
  (`watchSavedCart()`: storage events from other tabs, `pageshow` after a bfcache restore) everywhere
  except `/odeme`, and every cart write first takes over the saved cart (`syncSavedCart()`). Cart counts
  render 0 on the server and update after mount. `/siparis-basarili` empties the saved cart while the
  page is parsed (`components/checkout/ClearCartOnSuccess.tsx`, which repeats the persist key and shape).
- **Analytics.** The shell sends `POST /api/analytics/track {page}` once per store page view,
  including client-side navigations (the first one of a page load adds `landing: true` and `ref`:
  document.referrer, for traffic sources). The route writes the old `analytics` row and a cookieless
  `page_views` row (monthly-salted visitor hash, no IP stored; lib/analytics.ts). Admin › İstatistikler
  reads `GET /api/analytics/stats/`.
- **Sticky header.** The TopBar (`<aside aria-label="Duyurular">`) is static and the `<header>` is
  `position: sticky; top: 0` in normal flow. `<main>` has no top padding hack. On scroll-down the
  header's second row (mobile search field, desktop nav) slides under the first; on scroll-up it comes
  back (transforms only, from a passive rAF scroll listener).
- **Sticky parts under the header.** `components/layout/Header.tsx` writes `--header-open` /
  `--header-collapsed` on `<html>` only when its size or the breakpoint changes, and toggles
  `html[data-header-collapsed]` on collapse. Sticky parts under the header (listing toolbar, filter
  sidebar) carry `data-under-header` and get their `top` from rules in `app/globals.css`. Never write an
  inherited custom property on `<html>` on scroll (it restyles the whole page).
- **Session hint.** `lib/session-hint.ts` `hasSessionHint()` reads the readable cookie `onopo_oturum=1`,
  which worker.ts keeps in sync with the HttpOnly `auth_token` (login, verify-2fa and logout also set
  or clear it). It only means "this visitor may be logged in". Use it to skip pointless calls or pick a
  label on the client, never for access decisions. Today: the desktop account link (server HTML says
  "Giriş yap" → `/login/`, an effect switches to "Hesabım" → `/profile/`; the label box keeps the wider
  label's width, so nothing shifts) and `useFavorites()` (no `GET /api/favorites` for guests).
- **Header, Footer and MobileNav** return `null` when a page renders them itself inside the shell
  (only the shell passes `fromShell`), so nothing is rendered twice. No page does this today:
  `/help`, `/policy`, `/shipping` and `/terms` are 308 redirects to `/page/<slug>/`.
- **Signed-in visitors** who open `/login/` or `/register/` are redirected on the server to a safe
  `?redirect=` path, else `/profile/` (admins: `/`).
- **Favicon.** It is set in `generateMetadata` from `site_settings.favicon_url`, with
  `/favicon.ico` and `/favicon.svg` as the fallback. `app/favicon.ico` moved to
  `public/favicon.ico`, so Next no longer injects a second icon. The URL `/favicon.ico` is unchanged.
  Never add or remove `<link>` tags in `<head>` from client code. That is what caused the
  removeChild crash and reload loop.
- **Canonical.** The root layout emits none. Every page sets its own through `buildMetadata`
  (docs/SEO.md).

### Client access to layout data: `components/layout/store-data.tsx`

| Hook | Returns |
|---|---|
| `useStoreData()` | the whole `StorefrontData` (safe defaults outside the provider) |
| `useSiteSettings()` | `PublicSiteSettings` |
| `useShippingSettings()` | `{ freeShippingThreshold, shippingCost }` |
| `useCategories()` | `Category[]` with counts (hideEmpty) |
| `useMenus()` | flat `MenuItem[]` (Admin › Menüler) |
| `useOptionalStoreData()` | same as `useStoreData()`, or null outside the store layout |
| `useShellChrome()` | true while the shell renders header/footer |

### Errors: `app/error.tsx` and `components/GlobalErrorBoundary.tsx`

- `app/error.tsx` (route errors; it sits inside the shell's boundary and catches first) shows "Bir
  sorun oluştu" with "Tekrar dene" (`router.refresh()` + `reset()` in one transition) and "Ana sayfa".
- `GlobalErrorBoundary` shows "Bir sorun oluştu" with "Tekrar dene" (re-renders and calls
  `router.refresh()`), "Sayfayı yenile" (the user reloads) and "Ana sayfa".
- **Chunk-load errors** (a tab opened before a deploy asking for chunks that are gone, or a failed
  chunk download): both boundaries reload the page by themselves, once, through
  `reloadOnceForChunkError()`. The sessionStorage key `onopo:chunk-reload` allows one reload per path
  per 60 s, so it never loops. `app/error.tsx` shows "Sayfa yenileniyor…" instead of the error card
  while it reloads. For a chunk error "Tekrar dene" does a full reload in both boundaries (a re-render
  would ask for the same missing chunk).
- `redirect()` and `notFound()` are re-thrown to Next. The inline `window.onerror` reload script is gone.
- `app/error.tsx` renders `data-onopo-nocache=""`, so the edge cache never stores that response.

---

## 2. Data layer: `lib/catalog.ts` (server only)

`import 'server-only'`. Use it from Server Components, `generateMetadata` and route handlers. Every
getter is wrapped in React `cache()`, so the layout, the page and the metadata share one D1 round
trip per data set within a request. There is no cross-request cache, so admin edits show up on the
next request (the edge cache in worker.ts drops its copies when an admin write bumps
`site_settings.cache_version`). Layout data is one D1 `batch()` (settings, shipping, categories, menus, payment
flags) plus one products query.

### Types

```ts
interface Product {            // field names follow the D1 columns / API rows
  id, name, slug,
  price: number                // RAW DB price → pass to the cart (addItem)
  original_price: number|null  // raw
  display_price: number        // roundPrice(price) = what is shown AND charged per unit
  display_original_price: number|null   // rounded, only when higher than display_price
  discount_percent: number     // between display prices, 0 = no discount
  stock: number; in_stock: boolean
  images: string[]             // stored refs ("/api/images/<key>"), parsed once
  image: string|null           // images[0]
  category: string             // category NAME (products reference categories by name)
  product_code: string|null; free_shipping: boolean; created_at: string|null
}
interface ProductDetail extends Product { description, warranty_info, delivery_info, installment_info,
  whatsapp_order_enabled, whatsapp_number, is_active, updated_at }
interface Category { id, name, slug, icon, product_count, in_stock_count, href }
interface MenuItem { id, title, url, parent_id, sort_order, children }
interface HeroSlide { id, title, subtitle, button_text, button_link, image_url, display_order }
interface HomeSection { id, type, title, display_order, config, products?, viewAllHref?, slides?, categories? }
```

### Functions

| Function | Notes |
|---|---|
| `getSiteSettings()` | `PublicSiteSettings`, built from an **allowlist** of keys (admin_email and unknown keys never leave the server). JSON keys are parsed (`header_links`, `footer_categories`, `topbar_messages`), and booleans and numbers are typed. Never throws (falls back to defaults). |
| `getShippingSettings()` | `{ freeShippingThreshold, shippingCost }` from `shipping_settings` (default 500/100). |
| `getMaxInstallments()` | `site_settings.max_installments` when set (2–18). Otherwise 12 when PayTR is the active, configured provider (lib/payment/paytr.ts sends no limit, so the PayTR maximum of 12 applies). Otherwise `null`. Rates carry commission, so never write "vade farksız". |
| `getCategories({ withCounts = true, hideEmpty })` | Sorted by Turkish-folded name. The count rule is the same as the listings: `product.category` equals the category name OR slug, Turkish case-folded, over **all active products (in stock + sold out)**. `hideEmpty` drops categories whose listing would be empty. |
| `findCategory(slugOrName)` | Lookup by slug or name. |
| `categoryHref(category)` | Single place for category URLs: `/kategori/<slug>/` (`/products/?category=<name>` only when no slug is known). |
| `getMenus()` / `getMenuTree()` | Flat active menu items / top-level items with children. Children of an inactive parent are dropped, not promoted. |
| `getHeroSlides()` | Active slides, display order, max 5 (same as `/api/hero`). |
| `getHomepageSections()` | Active sections in admin order with data resolved on the server. For `products`/`new_products` over one pool (in-stock, newest first, max 200): `category` → case-insensitive match (pool order), `manual` → `product_ids` in the admin's order, `most_viewed` → most product-page views of the last 30 days (lib/analytics-db.ts, filled up with the newest), `newest`/`all` → whole pool; the order is stable unless `config.order === 'random'`; `limit || 8`. `hero` gets `slides` and `categories` gets `categories`. |
| `listProducts(params)` | See below. |
| `getActiveProducts()` | All active products, id DESC, one query per request. Throws if D1 is down. |
| `getInStockProducts()`, `getNewestProducts(limit, { includeSoldOut })` | Convenience. |
| `getProductBySlug(slug, { includeInactive })` / `getProductById(id, …)` | Full `ProductDetail`. **Active only** unless `includeInactive`. |
| `getRelatedProducts(product, { limit = 8 })` | In stock, same category first, ranked by shared facets (connector, wattage, type) and name words, padded with other products. |
| `getStorefrontData()` | What the root layout passes to the shell. Never throws. |

### `listProducts(params)` — listing, category and search pages

```ts
listProducts({
  q?, categorySlug?, categoryName?,      // a slug passed as name is resolved too
  facets?: string[],                     // FACETS keys (?f=), ANDed
  minPrice?, maxPrice?,                  // on the DISPLAY price, inclusive
  onlyDiscounted?, inStockOnly?,
  sort?: 'recommended'|'newest'|'price_asc'|'price_desc'|'discount',
  page?, pageSize?                       // default site_settings.products_per_page (20), max 200
}) → { items, total, inStockTotal, page, pageSize, totalPages, sort, category, categoryNotFound,
       query, queryHasNoTokens, facets: {key,label,count,selected}[], priceRange }
```

- It filters, searches, sorts and counts over the **full** catalogue, never over one page.
- **Out-of-stock policy (implemented; the owner can still change it):** active sold-out products
  are listed **after** all in-stock products, with `in_stock: false`. Cards show "Tükendi", and
  add-to-cart is disabled. Totals and category counts include them, so a count always equals what
  the listing shows. Home sections and related products keep showing in-stock products only, as
  before. The order API rejects a product with `stock <= 0` (400). Stock is a manual flag: sales do
  not decrement it.
- `recommended` means search relevance when `q` is given, otherwise newest (id DESC). Equal scores are
  ordered by `compareSearchTies` (shorter name first, then id DESC), the same rule as the
  instant-search dropdown, so pressing Enter keeps the dropdown's order.
- A query with no usable token (for example `%%`) returns 0 items. It never returns the whole
  catalogue.
- Facet counts show how many results you would get with that facet added. `priceRange` is computed
  before the price filter, for the filter UI.

---

## 3. Search: `lib/search.ts` (isomorphic)

The module has no server imports, so the same code runs in `listProducts`, in `/api/products?q=`
and in the browser.

| Export | Use |
|---|---|
| `foldTr(s)` | Turkish fold: İ/I/ı→i, ş→s, ğ→g, ç→c, ö→o, ü→u, accents stripped. Deterministic (no ICU). |
| `normalizeText(s)` | fold + punctuation → space (`"Type-C"` → `"type c"`). |
| `prepareQuery(q)` | `{ raw, norm, tokens }`. Stop words (ve, ile, için…) are dropped from multi-word queries. Max 8 tokens. |
| `searchItems(items, q, { limit, soldOutLast = true, tieBreak })` | Filter and rank any array with `name` (+ optional `slug`, `category`, `product_code`, `stock`, `id`). Order: sold-out last, score, then `tieBreak` (default `compareSearchTies`). |
| `compareSearchTies(a, b)` | The one tie rule for every search surface: shorter name first, then higher id. |
| `scoreSearch(item, prepared)` / `matchesSearch(item, q)` | Low-level helpers. |
| `FACETS`, `matchesFacet(name, key)`, `sanitizeFacetKeys(keys)` | Quick-filter chips: `iphone`, `type-c`, `micro-usb`, `arac`, `powerbank`, `kulaklik`, `ekran-koruyucu`, `kablo`, `sarj-aleti`, `20w`, `orgulu`. |
| `specChips(name, max = 2)` | Card chips parsed from the name: wattage, connector, capacity, length. |
| `displayName(name)` / `brandOf(name)` | Name without the leading "onopo" / `'ONOPO'` or null. |
| `splitDisplayName(name)` | `{ title, compat }` for cards and the search dropdown: a short generic leading phrase ending in "Uyumlu"/"İçin" (no number in it, at least 2 words after it) becomes `compat`, and `title` starts with the product type. A phrase that names a model stays in the title. Display only. |

Matching rules:

- All tokens must match (AND) in name, slug, category or product_code.
- Ranking order: exact name > exact phrase > name prefix > word-start > substring. Product-code
  hits are boosted.
- Tokens of 1–2 characters only match at the start of a word. A query that is a single character
  only matches the start of the name (without "onopo") or of the product code.
- Inside a multi-word query, a single character must be a whole word (`usb c`, `type c`).
- Numbers respect number boundaries: `15` matches "iphone 15" and "15w" but not "150".
- Glued forms match too: `typec` finds "Type-C".

**Instant-search dropdown:** on first focus, `components/search/search-index.ts` loads the index once
with `GET /api/products?index=1`. It returns all active products, in-stock first, as
`{id,name,slug,category,product_code,price,original_price,stock,image,free_shipping}` and is cached
for 300 s. The index is kept in memory and in sessionStorage for 10 minutes. On every keystroke
`components/search/SearchCombobox.tsx` ranks it with `searchItems` and shows the first 6 products,
plus up to 4 matching category / product-type links. Never navigate while the user types.
Submit goes to `/products/?q=` with `router.push`. The dropdown shows titles with `splitDisplayName`,
like the cards.

---

## 4. `/api/products` contract (app/api/products/route.ts)

| Request | Response |
|---|---|
| `?slug=…&exact=true`, `?search_slug=…` | unchanged |
| `?index=1` | **new**: compact search index (above) |
| `?page=N[&limit][&category][&q][&sort][&minPrice][&maxPrice][&f=…][&discounted=true][&inStock=true]` | unchanged shape `{products,totalCount,page,pageSize,totalPages}`, rows `{id,name,slug,price,original_price,stock,images(JSON string),category,free_shipping(0/1)}`. **Delegates to `listProducts`**: sold-out products are included after in-stock ones, the category matches by name OR slug, `q` uses lib/search, and the new optional params work. With `q` and the default sort the order is (in-stock first): score, then shorter name, then id DESC (`compareSearchTies`, the same as the dropdown and the `/products/?q=` page). |
| no `page` (legacy array: home, related products, admin pickers) | unchanged: in-stock only, id DESC, `limit` (default 24, max 200). `q` uses lib/search, ranked (same tie rule), then limited. |
| `?includeAll=true` (admin) | unchanged: active products, in stock or not. `q` uses lib/search. |
| `?includeAll=true&includeInactive=true` (Admin › Ürünler) | With a valid admin `auth_token` only: hidden (`is_active = 0`) rows too, an `is_active` field on every row, `Cache-Control: private, no-store`. Without an admin session the parameter is ignored. |
| any form with a `q` that has no usable token | `[]` or `{products:[],totalCount:0,…}`, never everything |

Related routes:

- `GET /api/products/<id>` (`app/api/products/[id]/route.ts`): for non-admins, 404 for inactive
  products and no `price_usd`; admins get the full row (`private, no-store`). Only the admin editors
  call it.
- `GET /api/homepage-sections?includeAll=true` with an admin `auth_token`: hidden sections too
  (`private, no-store`). Everyone else gets the active sections as before.
- Requests with `includeAll` or an `auth_token` cookie are never edge-cached (`lib/edge-cache.ts`).

---

## 5. Design tokens: `app/globals.css`

Tailwind 4 `@theme`. These utilities exist for every token (`bg-*`, `text-*`, `border-*`…).

| Group | Tokens |
|---|---|
| Neutrals | `canvas` #FFF · `surface` #F6F7F9 · `surface-2` #EEF1F4 · `field` #F3F5F8 (search/input bg) · `line` #E6E9EE · `line-strong` #CBD2DA · `ink` #0B1220 · `ink-2` #273142 · `muted` #5B6573 (secondary text) · `subtle` #8A94A3 (placeholder/disabled only) |
| Brand | `brand-50` #E6F6FC · `brand-100` · `brand-500` #0090C8 (icons, progress, large text) · `brand-600` #0077A8 (buttons, links) · `brand-700` #005F87 (hover) |
| Semantic | `sale` #D92D20 / `sale-50` · `success` #067647 / `success-50` · `warning` / `warning-50` · `danger` #B42318 · `whatsapp` #0E7A6E |
| Category accents | `cat-tech`, `cat-gaming`, `cat-beauty` (tiles/badges only) |
| Radius | `rounded-chip` 6 · `rounded-thumb` 8 · `rounded-card` 12 · `rounded-sheet` 16 |
| Shadow | `shadow-card` · `shadow-raised` · `shadow-overlay` · `shadow-focus` |
| Motion | `ease-sheet` (cubic-bezier(.2,.8,.2,1)); 150 ms hover, 200 ms dropdowns, 250 ms sheets |

- **Do not use** `rounded-sm/md/lg` or `shadow-sm/md/lg` to mean the spec values. Tailwind's own
  scale is unchanged because the admin panel depends on it (`rounded-lg` = 8px there). Use the
  semantic names above.
- Legacy colour names (`primary`, `secondary`, `accent`, `background`, `foreground`,
  `muted-foreground`, `border`) remain for the admin and older components. Do not use them in new
  storefront code.
- The store is light-only. `.dark`, `.glass` and `.glass-dark` were removed.

**Layout utilities:** `container-store` (max 1280, gutters 16/24/32), `section-y` (32 → 56 px),
`product-grid` (2/3/4 columns, gaps 12/16/24), `no-scrollbar`, `skeleton`, `tabular`.

**Typography:** one variable font, **Plus Jakarta Sans** (latin + latin-ext, `display: swap`)
through next/font, exposed as `--font-sans` on `<body>`. `font-heading` is an alias. The scale
utilities are mobile → desktop at `lg`:

`type-display` 28/34→44/52 800 · `type-h1` 22/28→30/38 700 · `type-h2` 18/24→24/32 700 ·
`type-h3` 16/22→18/26 600 · `type-body` 15/24 · `type-small` 13/20 · `type-micro` 11/16 600
uppercase · `type-card-title` 14/20 500 · `type-price` 16/20 800 tabular ·
`type-price-lg` 28/34→32/38 800 tabular.

Do not use CSS `capitalize`, because Turkish names are stored correctly. Uppercase is allowed only
for micro labels (`lang="tr"` handles İ).

**Base styles:** visible `:focus-visible` outline (2px brand-600, offset 2) on every interactive
element, `--shadow-focus` on inputs, 16px inputs on screens ≤768 px (no iOS zoom), tabular numbers
for `[data-price]`, and `prefers-reduced-motion` support (animations, transitions and shimmer off).

---

## 6. Components

Everything is server-friendly unless marked (client). New storefront code imports from these files.

| File | API |
|---|---|
| `components/ui/Container.tsx` | `<Container as?>` (= `container-store`), `<Section tone="canvas"\|"surface" containerClassName?>` |
| `components/ui/button.tsx` | `<Button variant size iconOnly fullWidth isLoading>`. Store variants: `brand` (primary CTA), `ink`, `outline-ink` (Hemen Al / card add), `subtle`, `white`, `whatsapp`, `plain`. Store sizes = height in px: `"32"`, `"40"`, `"44"`, `"48"`, `"52"`. Legacy variants and sizes are unchanged for admin. Use `buttonClasses({variant,size,…})` to style a `<Link>` as a button. Icon-only buttons need an `aria-label`. |
| `components/ui/badge.tsx` | Store variants: `sale` ("%41"), `soldout` ("Tükendi"), `new`, `brand`, `success`, `neutral` (spec chips). Legacy variants are unchanged. |
| `components/ui/Price.tsx` | `<Price price originalPrice rounded? size="sm"\|"card"\|"lg" showDiscountBadge showSaving>`. It takes RAW prices by default and shows `roundPrice` values (the charged amount). The strikethrough appears only when the old price is higher. The badge appears only when the discount is ≥ 5%. Pass `rounded` for sums or for values that are already display prices. |
| `components/ui/Breadcrumb.tsx` | `<Breadcrumb items={[{label, href?}]} jsonLd?>`. Use `breadcrumbJsonLd(items)` to merge it into your own JSON-LD. |
| `components/ui/JsonLd.tsx` | `<JsonLd data={…}>` (escapes `<`). |
| `components/ui/SectionHeader.tsx` | `<SectionHeader title description? href? linkLabel="Tümünü gör" as="h2"\|"h1"\|"h3" id?>` |
| `components/ui/Skeleton.tsx` | `<Skeleton>`, `<ProductCardSkeleton>`, `<ProductGridSkeleton count>`. Same geometry as the card. |
| `components/ui/EmptyState.tsx` | `<EmptyState icon title description? action={{label,href}}?>{custom actions}</EmptyState>` |
| `components/ui/FallbackImage.tsx` (client) | `<img>` with a one-shot chain: `src`(+`srcSet`) → `fallbackSrc` → `placeholderSrc` (default `/placeholder.svg`), then it stops. It also catches images that failed before hydration. Always pass `width`/`height` or use an aspect-ratio box. |
| `components/product/ProductCard.tsx` | `<ProductCard product rating? priority? eager? freeShippingThreshold? sizes? headingLevel="h3" showAddButton?>`, see below. Also exports `RatingStars`. |
| `components/product/ProductCardImages.tsx` (client) | The card's image well: main image plus the lazily added hover image (below). |
| `components/guides/GuideBody.tsx` | Guide article parts: `<GuideBody sections>` (H2 per section, paragraphs/lists/tips with `[label](/path/)` links), `<GuideToc>`, `<GuideFaqList>` (always visible), `<InlineText>`. Data: `lib/guides` (docs/SEO.md §12) |
| `components/guides/GuideCards.tsx` | `<GuideCards guides headingLevel>` (hub, "Diğer rehberler"), `<GuideLinkList guides>` (/kategoriler/ block) |
| `components/product/ProductCardActions.tsx` (client) | `<QuickAddButton product variant="icon"\|"full" openDrawer?>`, `<FavoriteButton productId productName variant="card"\|"plain">`, `useFavorites()`, `toCartItem(product)`, `resetFavorites()` |

### ProductCard (spec §9)

- `product` accepts a catalogue `Product`, an `/api/products` row (images as a JSON string,
  `free_shipping` as 0/1) or the `?index=1` payload.
- **Image well:** 1:1 and white, `object-contain` with 8% padding. On desktop hover it crossfades
  to the second image. The second `<img>` (and its request) is only added after the first mouse or
  pen `pointerenter` on the card while `(min-width: 1024px)` matches; the crossfade starts once it
  has loaded. Touch and keyboard never load it. Badges sit top-left (Tükendi, then `%NN` when ≥ 5%).
  The heart sits top-right. A round quick-add sits bottom-right on mobile.
- **Body:** eyebrow `ONOPO · <CODE>`, then a 2-line title from `splitDisplayName` (the "onopo" prefix
  stripped). A short generic leading phrase ending in "Uyumlu"/"İçin" moves to a muted line under the
  title (`data-card-compat`, `aria-hidden`; 34 products today, e.g. "Android Xiaomi ve Samsung
  uyumlu"), and the link then gets `aria-label` = the full name. The full name is always in
  `alt`/`title`; product data, JSON-LD and feeds are unchanged. Then up to 2 spec chips, the star row
  when `rating` is passed (`RatingStars`: the real average and count, or 5 stars "5,0 (0)" when there
  are no reviews; never used for JSON-LD), the price and strikethrough, "✓ Kargo bedava" (when
  `free_shipping` is set, or the display price ≥ `freeShippingThreshold`), and on desktop a 40 px
  "Sepete Ekle" button.
- **One stretched link** to `/<slug>/` (trailing slash, `prefetch={false}`) covers the card. The
  buttons sit above it.
- **Add to cart** uses the unchanged payload `{ id, name, price (raw), image, category, slug,
  free_shipping }` (`toCartItem`), shows "✓ Eklendi" for 1.5 s and a sonner toast with the remaining
  amount for free shipping and a "Sepete git" action. Cards do not open the drawer
  (`openDrawer` is for the product page). Sold-out cards render a disabled "Stokta yok" and no
  mobile add button.
- **Favourites:** `useFavorites()` loads `GET /api/favorites` once per page load (lazily, on idle),
  but only when the session hint is set; guests get an empty set without a request. It toggles with
  `POST /api/favorites {productId}` optimistically. A 401 (e.g. a guest's heart click) sends the
  visitor to `/login?redirect=<current url>`.
- **Images:** `productImageUrl(img, 400)` with srcset 200/400/800, `fallbackSrc` = the original.
  `priority` (eager + `fetchpriority=high`) is only for the likely LCP: the first 2 cards of a
  listing's first load (one row on phones) and at most 2 per home rail. `eager` (eager, normal
  priority) covers cards 3–4 of a listing (the rest of a desktop row). Every other card is lazy,
  including cards added by "Daha fazla göster".

---

## 7. Images: `lib/images.ts` (isomorphic)

- Stored references are `/api/images/<key>`; old rows use full `images.onopostore.com` or
  `pub-…r2.dev` URLs. Originals are served from `https://images.onopostore.com/<key>` (R2 custom
  domain, edge-cached).
- Variant convention: `https://images.onopostore.com/v/<w>/<key>.webp` for w ∈ `IMAGE_WIDTHS`
  (200, 400, 800, 1200).
- **The variants of the existing images are not uploaded yet.** `IMAGE_VARIANTS_ENABLED` is false
  unless the build sets `NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED=true` (it is inlined at build time;
  deploy.yml does not set it). While it is false, every helper returns the original URL and
  `productImageSrcSet` returns `undefined`. Switch it on only once `v/<w>/` exists for every stored
  image. New admin uploads already get their variants, made in the admin's browser
  (`lib/imageVariants.ts`, one file at a time).
- Helpers:
  - `originalImageUrl(url)`: same mapping as `getImageUrl`.
  - `productImageUrl(url, width)`: picks the next variant width ≥ the slot width.
  - `productImageSrcSet(url, widths)`.
  - `imageKey(url)`, `absoluteImageUrl(url)` for og/JSON-LD/icons.
  - `PRODUCT_CARD_SIZES`, `PLACEHOLDER_IMAGE`.
- Client `<img>`s must fall back once to the original (`FallbackImage`). No retry loops and no
  `?retry=` cache-busting.
- **og:image.** With variants on, the product page's `og:image`/`twitter:image` is
  `https://onopostore.com/api/og-image/<key>`, which redirects (302) to the 1200w variant when it exists
  in R2, else to the original; with variants off it is the original. PDP gallery slides 2+ and the
  desktop thumbnails mount on demand.
- **Home campaign slider.** `components/home/CampaignBanners.tsx` (+ `CampaignCarousel.tsx` island) at
  the top of the home page: admin Hero slides first (when that section is on), then the campaigns from
  `lib/campaigns.ts`, built from live data. Photos live in `public/kampanya/<name>-800|1600.webp`
  (16:9, shown cropped to 2:1). A photo with printed text lists what the text claims (`claims`); while
  the live data no longer says so, its text-free twin (`plain`) is shown with live text, so a printed
  discount or price is never stale. The 9D screen-protector banner always draws its price live (USD-based
  prices). Tests: `node --test scripts/campaigns.test.mjs`.
- **Logo.** With variants on, the header and footer logo use the 400w variant with a 200w/400w
  srcset, then fall back once to the original, then to the site name as text (`logoSources()` and
  `LOGO_SIZES` in `components/layout/Header.tsx`). With variants off, only the original.
- Feeds and JSON-LD always keep the ORIGINAL URLs.
- **Uploads** (`POST /api/admin/upload`): new originals get the key `<ms>-<8 hex>-<sanitized name>` and
  `Cache-Control: public, max-age=31536000, immutable` (keys are never reused). Originals uploaded
  before this change were stored without a Cache-Control.

---

## 8. Formatting: `lib/format.ts` (isomorphic, deterministic)

- `displayPrice(raw)` = `roundPrice(raw)`.
- `formatTL(n)` → `"1.234,50 ₺"`. It does not round to .99; use it for sums.
- `formatProductPrice(raw)`.
- `discountPercent(price, original)` and `MIN_DISCOUNT_BADGE_PERCENT` (5).
- `formatNumberTR`, `formatCount(n, 'ürün')`, `formatDateTR(utc)` (TR time).

The output never depends on ICU, so server HTML and hydration always match.

---

## 9. Known leftovers

The wave-1 list is done: the listing, product page and home page are server-rendered from the server
data modules (`lib/catalog.ts`, `lib/listing-data.ts`, `lib/product-data.ts`, `lib/home-data.ts`),
the old `ProductsClient`/`ProductClient` files are gone, and the header has the mega menu, the search
combobox and the z-index utilities (`z-header`, `z-drawer`, …). Still open:

- **404 body.** When a page calls `notFound()`, Next 16 answers 404 with noindex but an empty
  `__next_error__` shell; the 404 view (`app/not-found.tsx`) renders in the browser, where
  `NotFoundHead` (`components/status/status-islands.tsx`) keeps the title "Sayfa bulunamadı | Onopo"
  and noindex. A server-rendered 404 body needs a Next change or a rewrite of unknown URLs.
- **Image variants** are not in R2 yet, so `NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED` stays off (§7).
- **"Yeni Gelenler"** (`/new/` → `/products/?sort=newest`): the H1 still says "Tüm Ürünler", and
  `MegaMenu`'s `isActive` never marks a link that has a query, so "Tüm Ürünler" is the highlighted
  menu item there.
- **Category rename** updates `products.category`, but not the names stored in
  `site_settings.footer_categories` or in home sections with `selection_type: 'category'`. Fix those
  by hand after a rename.
