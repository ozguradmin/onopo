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
                    '/api/feeds/google',  // Allow Google to access product feed
                ],
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
                userAgent: 'Googlebot-Image',
                allow: '/',
            },
        ],
        sitemap: `${baseUrl}/sitemap.xml`,
    }
}
