import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl

    // Skip middleware for admin routes, API routes, static files, and maintenance page itself
    if (
        pathname.startsWith('/admin') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/favicon') ||
        pathname === '/maintenance' ||
        pathname.includes('.')
    ) {
        return NextResponse.next()
    }

    // Check maintenance mode from site-settings API
    try {
        const baseUrl = request.nextUrl.origin
        const settingsRes = await fetch(`${baseUrl}/api/site-settings`, {
            headers: { 'Cache-Control': 'no-cache' }
        })

        if (settingsRes.ok) {
            const settings = await settingsRes.json()

            if (settings.maintenance_mode === 'true' || settings.maintenance_mode === true) {
                // Redirect to maintenance page
                const maintenanceUrl = new URL('/maintenance', request.url)
                return NextResponse.redirect(maintenanceUrl)
            }
        }
    } catch (error) {
        // If settings fetch fails, allow normal access
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
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
