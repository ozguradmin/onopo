import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

/**
 * robots.txt (rules explained in docs/SEO.md, "robots.txt").
 * - /_next/ is NOT blocked: Google must load the JS/CSS to render pages.
 * - /api/ is blocked except the Google Merchant feed, image URLs and the read-only storefront APIs
 *   that client components still fetch while rendering (longest matching rule wins, so the Allow lines win).
 * - Private and transactional pages are blocked; they also send noindex.
 * - Internal search, filter and sort variants of listings are blocked (they are noindex,follow as well);
 *   ?page= and ?category= stay crawlable (pagination; ?category= 308-redirects to /kategori/<slug>/).
 * - The same file is served on www; www pages 301 to the apex, and the Sitemap line always names the apex.
 * One group for * and Googlebot (Googlebot ignores * when a Googlebot group exists, so both share the rules).
 */
export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: ['*', 'Googlebot'],
                allow: [
                    '/',
                    '/api/feeds/google',
                    '/api/images/',
                    '/api/products',
                    '/api/product-page-data/',
                    '/api/categories',
                    '/api/site-settings',
                    '/api/homepage-sections',
                    '/api/hero-slides',
                    '/api/shipping-settings',
                    '/api/pages/',
                    '/api/menus',
                ],
                disallow: [
                    '/admin/',
                    '/api/',
                    '/odeme/',
                    '/cart?',
                    '/cart/',
                    '/checkout?',
                    '/checkout/',
                    '/profile/',
                    '/orders/',
                    '/login/',
                    '/register/',
                    '/siparis-basarili/',
                    '/siparis-hata/',
                    '/maintenance/',
                    '/*?q=',
                    '/*&q=',
                    '/*?search=',
                    '/*&search=',
                    '/*?f=',
                    '/*&f=',
                    '/*?sort=',
                    '/*&sort=',
                    '/*?minPrice=',
                    '/*&minPrice=',
                    '/*?maxPrice=',
                    '/*&maxPrice=',
                    '/*?brand=',
                    '/*&brand=',
                ],
            },
        ],
        sitemap: `${SITE_URL}/sitemap.xml`,
    }
}
