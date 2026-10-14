import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Edge-compatible KV check for maintenance mode
// Since we can't call our own API from middleware reliably,
// we use Cloudflare KV or a simple header/cookie approach

export async function middleware(request: NextRequest) {
    // CPU Optimization: Removed maintenance mode check via API fetch
    // This was causing double CPU usage on every request
    // If maintenance mode is needed, use environment variable or KV binding instead
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
