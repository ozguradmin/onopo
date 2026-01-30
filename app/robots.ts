import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
    const baseUrl = 'https://onopostore.com'

    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/api/',
                    '/checkout/',
                    '/odeme/',
                    '/private/',
                    '/_next/',
                    '/login',
                    '/register',
                ],
            },
            {
                userAgent: 'Googlebot',
                allow: [
                    '/',
                    '/api/feed/products',  // Allow Google to access product feed
                ],
                disallow: [
                    '/admin/',
                    '/checkout/',
                    '/odeme/',
                ],
            },
            {
                userAgent: 'Googlebot-Image',
                allow: '/',
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
        host: baseUrl,
    }
}
