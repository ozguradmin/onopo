import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Edge-compatible KV check for maintenance mode
// Since we can't call our own API from middleware reliably,
// we use Cloudflare KV or a simple header/cookie approach

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip middleware for admin routes, API routes, static files, and maintenance page itself
    if (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname === '/maintenance' ||
        pathname.includes('.') ||
        pathname === '/login' ||
        pathname === '/register'
    ) {
        return NextResponse.next()
    }

    // For Cloudflare Pages, we need to check maintenance mode differently
    // Option 1: Use environment variable (requires redeploy to change)
    // Option 2: Use KV namespace (requires Cloudflare KV setup)
    // Option 3: Use a dedicated lightweight endpoint

    // We'll use a lightweight check via the request headers passed from Cloudflare
    // or fall back to checking via a simple fetch with timeout

    try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1000) // 1 second timeout

        const baseUrl = request.nextUrl.origin
        const settingsRes = await fetch(`${baseUrl}/api/site-settings`, {
            signal: controller.signal,
            headers: {
                'Cache-Control': 'no-cache',
                'x-middleware-check': 'true'
            },
            // Use next: { revalidate: 0 } for edge
        })

        clearTimeout(timeoutId)

        if (settingsRes.ok) {
            const settings = await settingsRes.json()

            if (settings.maintenance_mode === 'true' || settings.maintenance_mode === true) {
                // Redirect to maintenance page
                const maintenanceUrl = new URL('/maintenance', request.url)
                return NextResponse.redirect(maintenanceUrl)
            }
        }
    } catch (error) {
        // If settings fetch fails or times out, allow normal access
        // This prevents the site from breaking if the API is slow
        console.error('Middleware settings check failed:', error)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico|maintenance).*)',
    ],
}
