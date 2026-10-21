# Storefront frontend foundation

What the storefront is built on after the wave-1 foundation work. Read this before touching pages,
the header/footer, the listing, the product page or the checkout styling. The visual direction is
the design spec v1 (audit `tasarim-referans.md` → "Extra"); this file is the code contract.

Rules of thumb:

- Pages are **Server Components** that read data through `lib/catalog.ts`. Client components are
  small islands (cart, search box, favourites, filters, gallery). No page fetches its own data
  from `/api/*` in `useEffect` any more.
- Never fetch `/api/site-settings`, `/api/categories`, `/api/menus` or `/api/shipping-settings`
  from the browser. Use the store-data hooks instead (see "Layout and shell").
- No full-page spinners and no "Yükleniyor..." text. Skeletons only for in-page async parts.
- Never reload the page from code. No `window.location.reload()` and no `window.location.href = …`
  for internal navigation. Use `<Link>` or `router.push`.
- Keep all `/api/*` contracts (see `CLAUDE.md` and the audit `entegrasyonlar.md`).

---

## 1. Layout and shell

`app/layout.tsx` is a server component, and it is the only place that loads layout data:

```
RootLayout (server)            getStorefrontData(): settings, shipping, maxInstallments, categories, menus
 └ GlobalErrorBoundary (root)  last-resort fallback, never reloads by itself
    └ LayoutProvider (client)  components/layout/LayoutProvider.tsx
       ├ StoreDataProvider     context with the server data
       ├ Header (TopBar static + sticky header row)   ┐
       ├ CartDrawer                                     │ only on store paths
       ├ <main id="main-content">                      │
       │   └ GlobalErrorBoundary (page, resets on navigation) → {children}
       ├ Footer                                         │
       └ MobileNav                                      ┘
```

- `export const dynamic = 'force-dynamic'` in the root layout: every page is rendered per request
  with live data. No page is prerendered with build-time defaults.
- **Chrome by path.** `/admin/*` and `/maintenance` get no store header or footer. Admin keeps its
  own `app/admin/layout.tsx`.
- **Maintenance mode** (`site_settings.maintenance_mode`) is checked from server data. When it is on,
  every path except `/admin/*`, `/maintenance`, `/login` and `/register` renders a maintenance
  message in the server HTML. API routes are never affected.
- **The element around the page never changes type**, so pages mount exactly once. There is no mount
  gate and no remount.
- **Cart.** The shell calls `useCartStore.persist.rehydrate()` once on mount (the store uses
  `skipHydration`). Cart counts render 0 on the server and update after mount.
- **Analytics.** The shell sends `POST /api/analytics/track {page}` once per store page view,
  including client-side navigations. It moved here from Footer.
- **Sticky header.** The TopBar is static and the header row is `position: sticky; top: 0` in normal
  flow. `<main>` has no top padding hack any more. Many existing pages still carry their own
  `pt-24`/`pt-32`/`lg:mt-16` offsets for the old fixed header; remove them when you redesign the page.
- **Legacy pages that render `<Header/>`, `<Footer/>` or `<MobileNav/>` themselves** (`/help`,
  `/policy`, `/shipping`, `/terms`) get `null` from those components inside the shell, so nothing
  is rendered twice. Remove those imports when you touch those pages.
- **Favicon.** It is set in `generateMetadata` from `site_settings.favicon_url`, with
  `/favicon.ico` and `/favicon.svg` as the fallback. `app/favicon.ico` moved to
  `public/favicon.ico`, so Next no longer injects a second icon. The URL `/favicon.ico` is unchanged.
  Never add or remove `<link>` tags in `<head>` from client code. That is what caused the
  removeChild crash and reload loop.

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

### Errors: `components/GlobalErrorBoundary.tsx`

The boundary shows "Bir sorun oluştu" with three actions: "Tekrar dene" (re-renders and calls
`router.refresh()`), "Sayfayı yenile" (the user reloads) and "Ana sayfa". It reloads by itself only
for a `ChunkLoadError` after a deploy, at most once per path every 60 s (sessionStorage guard).
`redirect()` and `notFound()` are re-thrown to Next. The inline `window.onerror` reload script is gone.

---

## 2. Data layer: `lib/catalog.ts` (server only)

`import 'server-only'`. Use it from Server Components, `generateMetadata` and route handlers. Every
getter is wrapped in React `cache()`, so the layout, the page and the metadata share one D1 round
trip per data set within a request. There is no cross-request cache, so admin edits show up on the
next request. Layout data is one D1 `batch()` (settings, shipping, categories, menus, payment
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
| `categoryHref(category)` | Single place for category URLs. Currently `/products/?category=<name>`. Change it here when a `/kategori/<slug>/` route ships. |
| `getMenus()` / `getMenuTree()` | Flat active menu items / top-level items with children. |
| `getHeroSlides()` | Active slides, display order, max 5 (same as `/api/hero`). |
| `getHomepageSections()` | Active sections in admin order with data resolved on the server. For `products`/`new_products`: **exactly the old HomePageClient logic** over the same pool (in-stock, newest first, max 200): `category` → case-insensitive match, `manual` → `product_ids`, `newest`/`all` → whole pool; `products` is shuffled per request; `limit || 8`. `hero` gets `slides` and `categories` gets `categories`. |
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
  before. Note: the order API does not check stock yet (audit GAP-05). The owner of
  `app/api/orders` should add that check.
- `recommended` means search relevance when `q` is given, otherwise newest (id DESC).
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
| `searchItems(items, q, { limit, soldOutLast = true })` | Filter and rank any array with `name` (+ optional `slug`, `category`, `product_code`, `stock`, `id`). |
| `scoreSearch(item, prepared)` / `matchesSearch(item, q)` | Low-level helpers. |
| `FACETS`, `matchesFacet(name, key)`, `sanitizeFacetKeys(keys)` | Quick-filter chips: `iphone`, `type-c`, `micro-usb`, `arac`, `powerbank`, `kulaklik`, `ekran-koruyucu`, `kablo`, `sarj-aleti`, `20w`, `orgulu`. |
| `specChips(name, max = 2)` | Card chips parsed from the name: wattage, connector, capacity, length. |
| `displayName(name)` / `brandOf(name)` | Name without the leading "onopo" / `'ONOPO'` or null. |

Matching rules:

- All tokens must match (AND) in name, slug, category or product_code.
- Ranking order: exact name > exact phrase > name prefix > word-start > substring. Product-code
  hits are boosted.
- Tokens of 1–2 characters only match at the start of a word. A query that is a single character
  only matches the start of the name (without "onopo") or of the product code.
- Inside a multi-word query, a single character must be a whole word (`usb c`, `type c`).
- Numbers respect number boundaries: `15` matches "iphone 15" and "15w" but not "150".
- Glued forms match too: `typec` finds "Type-C".

**Instant-search dropdown (wave 2):** on first focus, load the index once with
`GET /api/products?index=1`. It returns all active products, in-stock first, as
`{id,name,slug,category,product_code,price,original_price,stock,image,free_shipping}` and is cached
for 300 s. Keep it in memory or sessionStorage and call
`searchItems(index, input, { limit: 6 })` on every keystroke. Never navigate while the user types.
Submit goes to `/products/?q=` with `router.push`.

---

## 4. `/api/products` contract (app/api/products/route.ts)

| Request | Response |
|---|---|
| `?slug=…&exact=true`, `?search_slug=…` | unchanged |
| `?index=1` | **new**: compact search index (above) |
| `?page=N[&limit][&category][&q][&sort][&minPrice][&maxPrice][&f=…][&discounted=true][&inStock=true]` | unchanged shape `{products,totalCount,page,pageSize,totalPages}`, rows `{id,name,slug,price,original_price,stock,images(JSON string),category,free_shipping(0/1)}`. **Now delegates to `listProducts`**: sold-out products are included after in-stock ones, the category matches by name OR slug, `q` uses lib/search, and the new optional params work. |
| no `page` (legacy array: home, related products, admin pickers) | unchanged: in-stock only, id DESC, `limit` (default 24, max 200). `q` now uses lib/search, ranked, then limited. |
| `?includeAll=true` (admin) | unchanged. `q` now uses lib/search. |
| any form with a `q` that has no usable token | `[]` or `{products:[],totalCount:0,…}`, never everything |

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
| `components/product/ProductCard.tsx` | `<ProductCard product priority? freeShippingThreshold? sizes? headingLevel="h3" showAddButton?>`, see below. |
| `components/product/ProductCardActions.tsx` (client) | `<QuickAddButton product variant="icon"\|"full" openDrawer?>`, `<FavoriteButton productId productName variant="card"\|"plain">`, `useFavorites()`, `toCartItem(product)`, `resetFavorites()` |

### ProductCard (spec §9)

- `product` accepts a catalogue `Product`, an `/api/products` row (images as a JSON string,
  `free_shipping` as 0/1) or the `?index=1` payload.
- **Image well:** 1:1 and white, `object-contain` with 8% padding. On desktop hover it crossfades
  to the second image. Badges sit top-left (Tükendi, then `%NN` when ≥ 5%). The heart sits
  top-right. A round quick-add sits bottom-right on mobile.
- **Body:** eyebrow `ONOPO · <CODE>`, then a 2-line title with the "onopo" prefix stripped (the full
  name is kept in `alt`/`title`). Then up to 2 spec chips, the price and strikethrough, "✓ Kargo
  bedava" (when `free_shipping` is set, or the display price ≥ `freeShippingThreshold`), and on
  desktop a 40 px "Sepete Ekle" button.
- **One stretched link** to `/<slug>/` (trailing slash, `prefetch={false}`) covers the card. The
  buttons sit above it.
- **Add to cart** uses the unchanged payload `{ id, name, price (raw), image, category, slug,
  free_shipping }` (`toCartItem`), shows "✓ Eklendi" for 1.5 s and a sonner toast with the remaining
  amount for free shipping and a "Sepete git" action. Cards do not open the drawer
  (`openDrawer` is for the product page). Sold-out cards render a disabled "Stokta yok" and no
  mobile add button.
- **Favourites:** `useFavorites()` loads `GET /api/favorites` once per page load (lazily, on idle)
  and toggles with `POST /api/favorites {productId}` optimistically. A 401 sends the visitor to
  `/login?redirect=<current url>`.
- **Images:** `productImageUrl(img, 400)` with srcset 200/400/800, `fallbackSrc` = the original.
  Pass `priority` for the first 4 cards of a listing and the first 2 of a carousel (eager +
  `fetchpriority=high`). Every other card is lazy.

---

## 7. Images: `lib/images.ts` (isomorphic)

- Stored references are `/api/images/<key>`; old rows use full `images.onopostore.com` or
  `pub-…r2.dev` URLs. Originals are served from `https://images.onopostore.com/<key>` (R2 custom
  domain, edge-cached).
- Variant convention: `https://images.onopostore.com/v/<w>/<key>.webp` for w ∈ `IMAGE_WIDTHS`
  (200, 400, 800, 1200).
- **The variants are not uploaded yet.** `IMAGE_VARIANTS_ENABLED` is false unless the build sets
  `NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED=true`. While it is false, every helper returns the original
  URL and `productImageSrcSet` returns `undefined`.
- Helpers:
  - `originalImageUrl(url)`: same mapping as `getImageUrl`.
  - `productImageUrl(url, width)`: picks the next variant width ≥ the slot width.
  - `productImageSrcSet(url, widths)`.
  - `imageKey(url)`, `absoluteImageUrl(url)` for og/JSON-LD/icons.
  - `PRODUCT_CARD_SIZES`, `PLACEHOLDER_IMAGE`.
- Client `<img>`s must fall back once to the original (`FallbackImage`). No retry loops and no
  `?retry=` cache-busting.
- Feeds, JSON-LD and og:image keep the ORIGINAL URLs.

---

## 8. Formatting: `lib/format.ts` (isomorphic, deterministic)

- `displayPrice(raw)` = `roundPrice(raw)`.
- `formatTL(n)` → `"1.234,50 ₺"`. It does not round to .99; use it for sums.
- `formatProductPrice(raw)`.
- `discountPercent(price, original)` and `MIN_DISCOUNT_BADGE_PERCENT` (5).
- `formatNumberTR`, `formatCount(n, 'ürün')`, `formatDateTR(utc)` (TR time).

The output never depends on ICU, so server HTML and hydration always match.

---

## 9. Known leftovers for wave 2 (not done in the foundation)

- **`app/products/ProductsPageClient.tsx` / `components/products/ProductsClient.tsx`:** these still
  fetch site-settings and categories twice and read `.q`/`.category` from `URLSearchParams`, so the
  h1 always says "Tüm Ürünler". Replace them with a server listing built on `listProducts`.
- **`app/product/[id]/ProductClient.tsx`:** its main image `onError` sets the same `/api/images/…`
  src again. If that URL fails too, it retries in an endless loop. Observed locally, where R2 is
  empty: thousands of requests. Use `FallbackImage`.
- **`components/home/*`:** ProductShowcase auto-scrolls and uses its own card. HeroSection and
  CategoriesSection fetch client-side. `getHomepageSections()` already provides `slides` and
  `categories`.
- **Header/Footer/TopBar/MobileNav** got only minimal changes: data from context, sticky header,
  client navigation and aria-labels. `header_links`, the mega menu, the search combobox and the
  bottom-nav search sheet are still to do. The z-index scale in the spec (header 40, overlay 50,
  drawer 60) is not applied yet: the header is still z-50.
- **Canonical:** the root layout no longer emits a canonical. The home page sets
  `alternates.canonical: '/'`, and every other page should set its own.
