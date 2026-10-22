import { getDB } from '@/lib/db'
import { getActiveProducts, getCategories, getMaxInstallments, getSiteSettings } from '@/lib/catalog'
import { getCmsPageLinks } from '@/lib/cms-pages'
import { deviceLlmsLinks } from '@/lib/devices'
import { GUIDES, guidePath } from '@/lib/guides'
import { rankMostViewed } from '@/lib/analytics'
import { recentProductViews, type D1Lite as AnalyticsDb } from '@/lib/analytics-db'
import { buildLlmsTxt, type LlmsSection } from '@/lib/llms-txt'
import { unitPrice } from '@/lib/pricing'
import { detectProductTypes, productPath } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'

// Read from D1 on every request (the database is not available at build time)
export const dynamic = 'force-dynamic'

/** Products listed by name and price (the rest is one "Tüm ürünler" link). */
const PRODUCT_LIMIT = 30

/**
 * https://onopostore.com/llms.txt: the store for AI assistants, from live data (format and honesty rules in
 * lib/llms-txt.ts). Edge-cached like the sitemap (lib/edge-cache.ts allowlist; admin writes bump
 * cache_version). Allowed in robots.txt by the '/' rule; not in the sitemap (it is not a page).
 * A catalogue read failure answers 500 (crawlers retry; never stored by the edge cache).
 */
export async function GET() {
    try {
        const [site, settings, products, categories, maxInstallments, pages] = await Promise.all([
            getSiteSeo(),
            getSiteSettings(),
            getActiveProducts(),
            getCategories({ hideEmpty: true }),
            getMaxInstallments(),
            getCmsPageLinks(),
        ])
        // Most viewed in the last 30 days first, then newest (the home page's "most viewed" order; never throws)
        const views = await recentProductViews((await getDB()) as unknown as AnalyticsDb, 30)
        const top = rankMostViewed(products.filter(p => p.in_stock), views, PRODUCT_LIMIT)

        // More sections go here, after the guides: { title, intro?, links }. The device pages (lib/devices): the
        // same indexable pages as the sitemap, from the same active products
        const extraSections: LlmsSection[] = []
        const devices = deviceLlmsLinks(products)
        if (devices.length) {
            extraSections.push({
                title: 'Cihaza göre',
                intro: 'Telefon ve tablet markasına ya da modeline göre ürün sayfaları.',
                links: devices,
            })
        }

        const body = buildLlmsTxt({
            siteName: site.name,
            productTypes: detectProductTypes(products.map(p => p.name)).map(t => t.plural),
            freeShippingThreshold: site.freeShippingThreshold,
            shippingCost: site.shippingCost,
            freeShippingProducts: products.filter(p => p.free_shipping).length,
            handlingTime: site.handlingTime,
            returnPolicy: site.returnPolicy,
            maxInstallments,
            contact: { whatsapp: settings.whatsapp_number || null, phone: site.phone ?? null, email: site.email ?? null },
            categories: categories.map(c => ({ label: c.name, path: c.href, note: `${c.product_count} ürün` })),
            guides: GUIDES.map(g => ({ label: g.title, path: guidePath(g.slug), note: g.description })),
            extraSections,
            products: top.map(p => ({ name: p.name, path: productPath(p.slug), price: unitPrice(p.price) })),
            productTotal: products.length,
            pages: pages.map(p => ({ label: p.title, path: p.href })),
        })
        return new Response(body, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'public, max-age=0, must-revalidate',
            },
        })
    } catch (err) {
        console.error('[llms.txt] catalogue unavailable:', err)
        return new Response('Geçici bir sorun oluştu, lütfen daha sonra tekrar deneyin.\n', {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        })
    }
}
