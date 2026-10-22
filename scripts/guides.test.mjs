// Unit tests for the shopping guides (/rehber/): the guide data (lib/guides), the related-product rules against the
// real catalogue names (scripts/fixtures/guide-catalog.json: the active products' public names, read 2026-10-22),
// the JSON-LD helpers, the sitemap rows (app/sitemap.ts with a fake D1), the edge-cache rules and the old-URL
// resolver (lib/redirects.ts must treat /rehber/ as live and never fuzzy-match under it).
// Run: node --test scripts/guides.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

// '@/…', extensionless relative paths and directories (index.ts) resolve to the .ts files; '@/lib/db' (Cloudflare context) is a fake
// that hands app/sitemap.ts the D1 stand-in in globalThis.__testDb.
const ROOT = new URL('../', import.meta.url)
const FAKE_DB_MODULE = 'data:text/javascript,export async function getDB() { return globalThis.__testDb }'
registerHooks({
    resolve(specifier, context, next) {
        if (specifier === '@/lib/db') return { url: FAKE_DB_MODULE, shortCircuit: true }
        let spec = specifier.startsWith('@/') ? new URL(specifier.slice(2), ROOT).href : specifier
        if ((spec.startsWith('.') || spec.startsWith('file:')) && !/\.[cm]?[jt]sx?$/.test(spec)) {
            for (const ext of ['.ts', '.tsx', '/index.ts']) {
                const url = new URL(spec + ext, context.parentURL)
                if (existsSync(fileURLToPath(url))) return next(url.href, context)
            }
        }
        return next(spec, context)
    },
})
const G = await import('../lib/guides/index.ts')
const seo = await import('../lib/seo.ts')
const search = await import('../lib/search.ts')
const edge = await import('../lib/edge-cache.ts')
const R = await import('../lib/redirects.ts')

const CATALOG = JSON.parse(readFileSync(new URL('fixtures/guide-catalog.json', import.meta.url), 'utf8'))
const byName = part => {
    const p = CATALOG.find(x => x.name.includes(part))
    assert.ok(p, `fixture has a product named like "${part}"`)
    return p
}

// ---------------------------------------------------------------------------------------------
// Guide data
// ---------------------------------------------------------------------------------------------

test('guides: six guides, unique slugs, the same list as lib/guides/slugs.ts', () => {
    assert.equal(G.GUIDES.length, 6)
    const slugs = G.GUIDES.map(g => g.slug)
    assert.deepEqual(slugs, [...G.GUIDE_SLUGS])
    assert.equal(new Set(slugs).size, slugs.length)
    for (const slug of slugs) {
        assert.match(slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, slug)
        assert.equal(G.getGuide(slug).slug, slug)
        assert.equal(G.guidePath(slug), `/rehber/${slug}/`)
    }
    assert.equal(G.getGuide('yok-boyle-rehber'), null)
    assert.equal(G.getGuide('toString'), null)
    assert.equal(G.getGuide(slugs[0].toUpperCase()), null)
})

test('guides: titles fit <title> (≤ 52 + " | Onopo"), descriptions are 140–160 characters, titles and descriptions unique', () => {
    for (const g of G.GUIDES) {
        assert.ok(g.title.length >= 20 && g.title.length <= 52, `${g.slug} title ${g.title.length}`)
        assert.ok((g.title + seo.SITE.titleSuffix).length <= 60, g.slug)
        assert.ok(g.description.length >= 140 && g.description.length <= 160, `${g.slug} description ${g.description.length}`)
        assert.ok(g.intro.length >= 120, `${g.slug} intro`)
        assert.ok(g.productsTitle.length > 0 && g.productsTitle.length <= 60, g.slug)
        // buildMetadata keeps the text as written (no cut, no ellipsis) and a canonical with the trailing slash
        const md = seo.buildMetadata({ title: g.title, description: g.description, path: G.guidePath(g.slug), type: 'article' })
        assert.equal(md.description, g.description)
        assert.equal(md.alternates.canonical, `https://onopostore.com/rehber/${g.slug}/`)
        assert.equal(md.openGraph.type, 'article')
    }
    assert.equal(new Set(G.GUIDES.map(g => g.title)).size, 6)
    assert.equal(new Set(G.GUIDES.map(g => g.description)).size, 6)
    const hub = G.GUIDES_HUB.description.length
    assert.ok(hub >= 140 && hub <= 160, `hub description ${hub}`)
})

test('guides: about 600–900 words, real sections, a visible FAQ, valid dates', () => {
    for (const g of G.GUIDES) {
        const words = G.guideWordCount(g)
        assert.ok(words >= 600 && words <= 900, `${g.slug}: ${words} words`)
        assert.ok(g.sections.length >= 4, g.slug)
        const ids = g.sections.map(s => s.id)
        assert.equal(new Set(ids).size, ids.length, `${g.slug} section ids`)
        for (const s of g.sections) {
            assert.match(s.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `${g.slug} #${s.id}`)
            assert.notEqual(s.id, 'sik-sorulan-sorular')
            assert.ok(s.heading.trim() && s.blocks.length > 0, `${g.slug} #${s.id}`)
            for (const b of s.blocks) {
                if (b.type === 'ul' || b.type === 'ol') assert.ok(b.items.length >= 2 && b.items.every(i => i.trim()), `${g.slug} #${s.id}`)
                else assert.ok(b.text.trim(), `${g.slug} #${s.id}`)
            }
        }
        assert.ok(g.faq.length >= 3, `${g.slug} faq`)
        for (const f of g.faq) assert.ok(f.q.endsWith('?') && f.a.length >= 40, `${g.slug}: ${f.q}`)
        assert.match(g.datePublished, /^\d{4}-\d{2}-\d{2}$/)
        assert.match(g.dateModified, /^\d{4}-\d{2}-\d{2}$/)
        assert.ok(!Number.isNaN(Date.parse(g.datePublished)) && g.dateModified >= g.datePublished, g.slug)
        assert.ok(G.guideReadingMinutes(g) >= 3, g.slug)
    }
})

test('guides: no prices, stock counts or link syntax left in the visible text; internal links go to live guides', () => {
    for (const g of G.GUIDES) {
        for (const t of G.guideTexts(g)) {
            assert.doesNotMatch(t, /\d\s?(TL|₺)|\bfiyat/i, `${g.slug}: ${t}`)
            assert.doesNotMatch(t, /[[\]]|\]\(/, `${g.slug}: leftover link syntax in "${t}"`)
        }
        for (const href of G.guideLinks(g)) {
            assert.match(href, /^\/rehber\/[a-z0-9-]+\/$/, `${g.slug} → ${href}`)
            const target = G.getGuide(href.split('/')[2])
            assert.ok(target, `${g.slug} links to a missing guide ${href}`)
            assert.notEqual(target.slug, g.slug, `${g.slug} links to itself`)
        }
    }
})

test('parseInlineLinks: [label](/path/) becomes a link, everything else stays text', () => {
    assert.deepEqual(G.parseInlineLinks('Bkz. [hızlı şarj rehberi](/rehber/x/) ve devamı.'), ['Bkz. ', { label: 'hızlı şarj rehberi', href: '/rehber/x/' }, ' ve devamı.'])
    assert.deepEqual(G.parseInlineLinks('Düz metin'), ['Düz metin'])
    // Only same-site paths: an external URL is left as text
    assert.deepEqual(G.parseInlineLinks('[x](https://example.com/)'), ['[x](https://example.com/)'])
})

test('formatGuideDate: Turkish month names, no ICU', () => {
    assert.equal(G.formatGuideDate('2026-10-22'), '22 Ekim 2026')
    assert.equal(G.formatGuideDate('2026-01-05'), '5 Ocak 2026')
    assert.equal(G.formatGuideDate('bad'), 'bad')
})

// ---------------------------------------------------------------------------------------------
// Related products
// ---------------------------------------------------------------------------------------------

test('product rules: every clause is a real query (known facet keys and/or a usable search) that finds catalogue products', () => {
    for (const g of G.GUIDES) {
        for (const clause of [...g.products.clauses, ...(g.productMatch ?? [])]) {
            const label = `${g.slug} ${JSON.stringify(clause)}`
            assert.ok(clause.facets?.length || clause.q, `${label}: empty clause`)
            if (clause.facets) assert.deepEqual(search.sanitizeFacetKeys(clause.facets), [...clause.facets].sort((a, b) => search.FACETS.findIndex(f => f.key === a) - search.FACETS.findIndex(f => f.key === b)), `${label}: unknown facet`)
            if (clause.q) assert.ok(search.hasUsableQuery(clause.q), `${label}: unusable query`)
            assert.ok(CATALOG.some(p => G.matchesGuideClause(p, clause)), `${label}: matches no product in the catalogue`)
        }
        for (const id of g.products.ids ?? []) assert.ok(Number.isInteger(id) && id > 0, g.slug)
    }
})

test('selectGuideProducts: each guide gets 4–8 relevant products from the real catalogue, in stock first, no duplicates', () => {
    const expect = {
        'iphone-sarj-aleti-ve-kablo-secimi': p => /iphone/i.test(p.name) && /lightning|başlı|adaptör/i.test(p.name),
        'hizli-sarj-nedir-pd-watt-amper': p => /şarj/i.test(p.name) && /\d+W\b/i.test(p.name),
        'ekran-koruyucu-secimi-9d-12d-seramik': p => /ekran koruyucu/i.test(p.name) && /\b(9D|12D)\b/.test(p.name),
        'tablet-ekran-koruyucu-model-kodu-bulma': p => /çerçeveli seramik/i.test(p.name),
        'arac-sarj-cihazi-nasil-secilir': p => /araç şarj/i.test(p.name) || /mini/i.test(p.name) && /kablo/i.test(p.name),
        'powerbank-secimi-mah-ve-cikis-gucu': p => /powerbank/i.test(p.name) || /mini/i.test(p.name) && /kablo/i.test(p.name),
    }
    for (const g of G.GUIDES) {
        const list = G.selectGuideProducts(CATALOG, g.products)
        assert.ok(list.length >= 4 && list.length <= 8, `${g.slug}: ${list.length}`)
        assert.equal(new Set(list.map(p => p.id)).size, list.length, g.slug)
        const firstSoldOut = list.findIndex(p => !p.in_stock)
        if (firstSoldOut >= 0) assert.ok(list.slice(firstSoldOut).every(p => !p.in_stock), `${g.slug}: in stock first`)
        for (const p of list) assert.ok(expect[g.slug](p), `${g.slug}: unexpected product "${p.name}"`)
    }
    // Mixed types: the fast-charging guide shows chargers and cables, the screen protector guide 9D and 12D
    const fast = G.selectGuideProducts(CATALOG, G.getGuide('hizli-sarj-nedir-pd-watt-amper').products)
    assert.ok(fast.some(p => /kablo/i.test(p.name)) && fast.some(p => !/kablo\b|kablosu/i.test(p.name)))
    const screen = G.selectGuideProducts(CATALOG, G.getGuide('ekran-koruyucu-secimi-9d-12d-seramik').products)
    assert.ok(screen.some(p => /9D/.test(p.name)) && screen.some(p => /12D/.test(p.name)))
})

test('selectGuideProducts: explicit ids first, clauses in turns, sold-out last, limit', () => {
    const products = [
        { id: 9, name: 'Onopo 20000 mAh Powerbank', in_stock: false },
        { id: 8, name: 'Onopo Type-C Mini Kablo 30CM', in_stock: true },
        { id: 7, name: 'Onopo 10000 mAh Powerbank', in_stock: true },
        { id: 6, name: 'Onopo Lightning Mini Kablo 30CM', stock: 5 },
        { id: 5, name: 'Onopo 5000 mAh Powerbank', stock: 0 },
        { id: 4, name: 'Onopo Bluetooth Kulaklık' },
    ]
    const rule = { clauses: [{ facets: ['powerbank'] }, { facets: ['kablo'], q: 'mini' }] }
    assert.deepEqual(G.selectGuideProducts(products, rule).map(p => p.id), [8, 7, 6, 9, 5])
    assert.deepEqual(G.selectGuideProducts(products, { ...rule, ids: [6, 404] }).map(p => p.id), [6, 8, 7, 9, 5])
    assert.deepEqual(G.selectGuideProducts(products, rule, 2).map(p => p.id), [8, 7])
    assert.deepEqual(G.selectGuideProducts(products, { clauses: [{}] }), [])
})

test('guideForProduct: product pages link the most specific guide, and nothing for products no guide covers', () => {
    const cases = [
        ['Galaxy Tab S6 Lite SM-P615', 'tablet-ekran-koruyucu-model-kodu-bulma'],
        ['iPad Pro 11 İnç Siyah', 'tablet-ekran-koruyucu-model-kodu-bulma'],
        ['iPhone 16 Pro Max Anti Static 9D', 'ekran-koruyucu-secimi-9d-12d-seramik'],
        ['Redmi Note 12 Uyumlu Tam Kaplayan Şeffaf Seramik 12D', 'ekran-koruyucu-secimi-9d-12d-seramik'],
        ['Turbo Hızlı Araç Şarjı 55W', 'arac-sarj-cihazi-nasil-secilir'],
        ['10000 mAh Şarj Edilebilir', 'powerbank-secimi-mah-ve-cikis-gucu'],
        ['Type-C to Lightning PD 20W Hızlı Şarj ve Data Kablosu 100CM', 'iphone-sarj-aleti-ve-kablo-secimi'],
        ['Lightning to USB Mini Kablo', 'iphone-sarj-aleti-ve-kablo-secimi'],
        ['iPhone ve Android Uyumlu 20W Type-C Girişli Şarj Başlığı', 'iphone-sarj-aleti-ve-kablo-secimi'],
        ['67W USB Turbo Hızlı Şarj Aleti Seti', 'hizli-sarj-nedir-pd-watt-amper'],
        ['T120 USB-A to Type-C Turbo', 'hizli-sarj-nedir-pd-watt-amper'],
        ['Micro USB Hızlı Şarj ve Data Kablosu 3.0A', 'hizli-sarj-nedir-pd-watt-amper'],
        ['S2 12W 2.4A USB Şarj Adaptörü', 'hizli-sarj-nedir-pd-watt-amper'],
    ]
    for (const [part, slug] of cases) assert.equal(G.guideForProduct(byName(part))?.slug, slug, part)
    for (const part of ['Bluetooth 5.3 Kablosuz Kulaklık', 'Araç Süpürgeleri ile Uyumlu Yedek Hepa Filtre', 'Aux Kablosu', 'Termal Etiket Yazıcısı', 'Gamepad', 'El Süpürgesi']) {
        assert.equal(G.guideForProduct(byName(part)), null, part)
    }
    // Every guide is linked from at least one product page
    const linked = new Set(CATALOG.map(p => G.guideForProduct(p)?.slug).filter(Boolean))
    assert.deepEqual([...linked].sort(), [...G.GUIDE_SLUGS].sort())
})

// ---------------------------------------------------------------------------------------------
// JSON-LD
// ---------------------------------------------------------------------------------------------

test('articleJsonLd and faqPageJsonLd: absolute canonical URL, dates, the store as author and publisher, plain-text answers', () => {
    const g = G.getGuide('powerbank-secimi-mah-ve-cikis-gucu')
    const a = seo.articleJsonLd({ headline: g.title, description: g.description, path: G.guidePath(g.slug), datePublished: g.datePublished, dateModified: g.dateModified }, { name: 'Onopo Store', logo: 'https://images.onopostore.com/logo.png' })
    assert.equal(a['@type'], 'Article')
    assert.equal(a.url, `https://onopostore.com/rehber/${g.slug}/`)
    assert.deepEqual(a.mainEntityOfPage, { '@type': 'WebPage', '@id': a.url })
    assert.equal(a.datePublished, '2026-10-22')
    assert.equal(a.dateModified, g.dateModified)
    assert.equal(a.publisher['@type'], 'Organization')
    assert.equal(a.publisher['@id'], seo.ORGANIZATION_ID)
    assert.deepEqual(a.publisher.logo, { '@type': 'ImageObject', url: 'https://images.onopostore.com/logo.png' })
    assert.deepEqual(a.author, a.publisher)
    assert.deepEqual(a.image, ['https://onopostore.com/og-image.jpg'])
    assert.equal(seo.articleJsonLd({ ...a, headline: 'x', path: '/rehber/x/' }).publisher.logo, undefined)

    const faq = seo.faqPageJsonLd(g.faq.map(f => ({ question: f.q, answer: f.a })))
    assert.equal(faq['@type'], 'FAQPage')
    assert.equal(faq.mainEntity.length, g.faq.length)
    assert.deepEqual(faq.mainEntity[0], { '@type': 'Question', name: g.faq[0].q, acceptedAnswer: { '@type': 'Answer', text: g.faq[0].a } })
    // Rendered safely inside <script>
    assert.doesNotMatch(seo.serializeJsonLd(seo.faqPageJsonLd([{ question: '</script>?', answer: 'a' }])), /<\/script>/)
})

test('guide pictures: our own photos of in-stock related products, in the product row order, each photo once, at most 3', () => {
    // The real catalogue names with made-up image references (the fixture has no images)
    const withImages = CATALOG.map(p => ({ ...p, image: `/api/images/${p.id}-photo.webp` }))
    for (const g of G.GUIDES) {
        const images = G.selectGuideImages(withImages, g)
        const expected = G.selectGuideProducts(withImages, g.products, withImages.length).filter(p => p.in_stock).slice(0, G.GUIDE_IMAGE_COUNT)
        assert.ok(images.length >= 1 && images.length <= 3, `${g.slug}: ${images.length}`)
        assert.deepEqual(images.map(i => i.image), expected.map(p => p.image), g.slug)
        for (const img of images) {
            assert.ok(img.alt.length > 3 && img.alt.length <= 90, `${g.slug}: alt "${img.alt}"`)
            assert.doesNotMatch(img.alt, /^onopo\b| \| /i, `${g.slug}: alt "${img.alt}"`)
        }
    }
    const rule = { products: { clauses: [{ q: 'kablo' }] } }
    const products = [
        { id: 1, name: 'Onopo Kablo A | 1 Metre', in_stock: false, image: '/api/images/a.webp' },
        { id: 2, name: 'Kablo B', in_stock: true, image: null },
        { id: 3, name: 'Kablo C', in_stock: true, image: '  ' },
        { id: 4, name: 'Kablo D', in_stock: true, image: '/api/images/d.webp' },
        { id: 5, name: 'Kablo E (aynı foto)', in_stock: true, image: '/api/images/d.webp' },
        { id: 6, name: 'Onopo Kablo F | Hızlı Şarj | 2 Metre', stock: 3, image: '/api/images/f.webp' },
        { id: 7, name: 'Kablo G', stock: 1, image: '/api/images/g.webp' },
        { id: 8, name: 'Kablo H', stock: 1, image: '/api/images/h.webp' },
        { id: 9, name: 'Şarj Aleti', in_stock: true, image: '/api/images/s.webp' },
    ]
    // Sold out (1), no photo (2, 3), the same photo again (5) and unrelated products (9) are skipped
    assert.deepEqual(G.selectGuideImages(products, rule), [
        { image: '/api/images/d.webp', alt: 'Kablo D' },
        { image: '/api/images/f.webp', alt: 'Kablo F' },
        { image: '/api/images/g.webp', alt: 'Kablo G' },
    ])
    assert.equal(G.selectGuideImages(products, rule, 1).length, 1)
    assert.deepEqual(G.selectGuideImages([], rule), [])
    // Every guide, keyed by slug (hub cards, lists)
    const bySlug = G.guideImagesBySlug(products)
    assert.deepEqual(Object.keys(bySlug).sort(), [...G.GUIDE_SLUGS].sort())
    assert.equal(G.guideImageAlt('Onopo   T120 USB-A to Type-C Kablo | 120W GaN | 1 Metre'), 'T120 USB-A to Type-C Kablo')
    assert.ok(G.guideImageAlt('X'.repeat(200)).length <= 90)
})

test("articleJsonLd: the guide's product photos as the Article image (absolute originals), the og-image without them", () => {
    const g = G.getGuide('powerbank-secimi-mah-ve-cikis-gucu')
    const base = { headline: g.title, description: g.description, path: G.guidePath(g.slug), datePublished: g.datePublished, dateModified: g.dateModified }
    const images = ['https://images.onopostore.com/a.webp', 'https://images.onopostore.com/b.webp']
    assert.deepEqual(seo.articleJsonLd({ ...base, images }).image, images)
    assert.deepEqual(seo.articleJsonLd({ ...base, images: [] }).image, ['https://onopostore.com/og-image.jpg'])
})

// ---------------------------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------------------------

test('sitemap: /rehber/ and every guide are listed with their dateModified; the rest of the file is unchanged', async () => {
    const rows = {
        products: [{ slug: 'onopo-urun', images: '[]', updated_at: '2026-10-20 10:00:00', created_at: '2026-01-01 00:00:00' }],
        categories: [{ slug: 'cep-telefonu-aksesuarlari', lastmod: '2026-10-20 10:00:00' }],
        pages: [{ slug: 'help', updated_at: '2026-09-01 00:00:00' }],
    }
    globalThis.__testDb = {
        prepare: sql => ({
            all: async () => ({ results: /FROM products/.test(sql) && !/categories/.test(sql) ? rows.products : /FROM categories/.test(sql) ? rows.categories : rows.pages }),
        }),
    }
    const { default: sitemap } = await import('../app/sitemap.ts')
    const entries = await sitemap()
    const byUrl = new Map(entries.map(e => [e.url, e]))
    const hub = byUrl.get('https://onopostore.com/rehber/')
    assert.ok(hub, 'hub listed')
    for (const g of G.GUIDES) {
        const e = byUrl.get(`https://onopostore.com/rehber/${g.slug}/`)
        assert.ok(e, `${g.slug} listed`)
        assert.equal(e.lastModified, g.dateModified)
        assert.ok(hub.lastModified >= g.dateModified)
    }
    for (const url of ['https://onopostore.com/', 'https://onopostore.com/kategori/cep-telefonu-aksesuarlari/', 'https://onopostore.com/onopo-urun/', 'https://onopostore.com/page/help/']) {
        assert.ok(byUrl.has(url), url)
    }
    assert.equal(entries.length, byUrl.size, 'no duplicates')
    assert.deepEqual(G.guideSitemapEntries().map(e => e.path), ['/rehber/', ...G.GUIDES.map(g => `/rehber/${g.slug}/`)])
})

// ---------------------------------------------------------------------------------------------
// Edge cache and old-URL redirects
// ---------------------------------------------------------------------------------------------

test('edge cache: the hub and the guides are cacheable public pages (not product pages)', () => {
    const html = 'text/html; charset=utf-8'
    for (const path of ['/rehber/', `/rehber/${G.GUIDE_SLUGS[0]}/`]) {
        assert.equal(edge.isCacheablePath(path), true, path)
        assert.equal(edge.isProductSlugPath(path), false, path)
        assert.equal(edge.isStorableBody(path, html, '<main><h1>Rehber</h1></main>'), true, path)
        assert.equal(edge.isStorableBody(path, html, '<div hidden data-onopo-nocache=""></div>'), false, path)
    }
    assert.equal(edge.isCacheablePath('/rehber/a/b/'), false)
    assert.equal(edge.isCacheablePath('/rehber/Buyuk-Harf/'), false)
})

const CATEGORIES = [{ name: 'Cep Telefonu Aksesuarları', slug: 'cep-telefonu-aksesuarlari', product_count: 108 }]
const index = R.buildIndex({
    products: CATALOG.map(p => ({ id: p.id, slug: seo.slugifyTr(p.name), name: p.name, is_active: 1, images: '[]' })),
    categories: CATEGORIES,
    pages: [{ slug: 'help' }],
})
const resolveTarget = async path => (await R.resolvePath(path, { index }))?.target ?? null

test('redirects: /rehber/ pages are live targets, never redirected from, and nothing under /rehber/ is guessed', async () => {
    const guide = `/rehber/${G.GUIDE_SLUGS[5]}/`
    assert.equal(R.isLiveTarget('/rehber/', index), true)
    assert.equal(R.isLiveTarget(guide, index), true)
    assert.equal(R.isLiveTarget('https://onopostore.com/rehber/arac-sarj-cihazi-nasil-secilir/', index), true)
    assert.equal(R.isLiveTarget('/rehber/yok-boyle-rehber/', index), false)

    // The admin can point an old URL at a guide, but cannot redirect a live guide away
    assert.deepEqual(R.validateRedirect('/blog/powerbank-rehberi/', guide, index), { ok: true, from: '/blog/powerbank-rehberi/', to: guide })
    assert.equal(R.validateRedirect(guide, '/products/', index).ok, false)
    assert.equal(R.validateRedirect('/rehber/', '/products/', index).ok, false)

    // A wrong guide URL that looks like a product name stays a 404 (logged), it is not fuzzy-matched to a product
    const powerbank = CATALOG.find(p => /20000 mAh/.test(p.name))
    assert.ok(await resolveTarget(`/urun/${seo.slugifyTr(powerbank.name)}-eski/`), 'the same words outside /rehber/ do resolve')
    assert.equal(await resolveTarget(`/rehber/${seo.slugifyTr(powerbank.name)}/`), null)
    assert.equal(await resolveTarget('/rehber/powerbank-secimi/'), null)
    assert.equal(await resolveTarget('/rehber/a/b/'), null)

    // Other spellings of a real guide go to it in one hop
    assert.equal(await resolveTarget('/rehber/powerbank-secimi-mah-ve-cikis-gucu.html'), guide)
    assert.equal(await resolveTarget('/powerbank-secimi-mah-ve-cikis-gucu/'), guide)
    assert.equal(await resolveTarget('/blog/powerbank-secimi-mah-ve-cikis-gucu/'), guide)
    assert.equal(R.isLegacyPattern('/rehber/x'), false)
})
