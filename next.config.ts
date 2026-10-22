import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true, // Cloudflare Workers doesn't support Next.js Image Optimization
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'pub-84a4a4a7d990439cbfeb17aaa4c7677c.r2.dev',
        pathname: '/**',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb', // Increase limit for file uploads
    },
    // Client router cache (in the visitor's tab only, never shared): a page visited in the last 30 s, or prefetched
    // in full (components/layout/PrefetchLink.tsx) in the last 3 min, opens without waiting for the server when the
    // visitor taps back to it (bottom-nav tabs). Every page is dynamic, so the default (0 s) re-rendered it on each
    // tap. Logout calls router.refresh() and login is a full page load, both of which drop this cache.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  // Force trailing slashes for better SEO
  trailingSlash: true,

  async rewrites() {
    return [
      {
        source: '/export/3d8f6f5317c8d55d5f54b082f1fcb46cpnldbKp6eyhPkP9SVQ==',
        destination: '/api/feeds/akakce',
      },
    ]
  },
  // Security headers for every response. There is deliberately no blanket Cache-Control here:
  // config headers override what route handlers set, and a site-wide 'public' value used to mark
  // personal, admin and payment responses as cacheable. Public routes send their own Cache-Control,
  // /_next/static is cached by public/_headers (static assets never reach the Worker) and the
  // edge cache in worker.ts only stores an allowlist of anonymous public GETs.
  async headers() {
    const securityHeaders = [
      { key: 'X-DNS-Prefetch-Control', value: 'on' },
      { key: 'X-XSS-Protection', value: '1; mode=block' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
    ]
    const noStore = [{ key: 'Cache-Control', value: 'private, no-store' }]
    // APIs whose responses are personal, admin-only, payment/auth/order related, integrations or cron
    // (ai: the Onopo Asistan chat stream and its beacons)
    const privateApis = 'admin|auth|orders|birfatura|payment|cron|user|favorites|coupons|installment-token|analytics|migrations|upload|fix-db|seed-pages|ai'
    // Pages that belong to one visitor (account, checkout, admin)
    const privatePages = 'admin|odeme|profile|orders|login|register|siparis-basarili|siparis-hata'
    // JSON/API responses are never indexed. Not on /api/images/* (stored product image URLs must stay
    // indexable for image search) and /api/feeds/* (Merchant/Akakçe feeds are left as they are).
    const noIndex = [{ key: 'X-Robots-Tag', value: 'noindex' }]
    // The admin panel is a client app without page metadata (it would inherit the store's index,follow).
    const noIndexNoFollow = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }]
    return [
      { source: '/:path*', headers: securityHeaders },
      // og-image redirects to the product image that link previews and Google use: no noindex on it
      { source: '/api/:path((?!images(?:/|$)|feeds(?:/|$)|og-image(?:/|$)).*)', headers: noIndex },
      { source: `/api/:area(${privateApis})`, headers: noStore },
      { source: `/api/:area(${privateApis})/:rest*`, headers: noStore },
      // Answers admins with admin_email on the same URL: never cacheable (public subset: /api/site-settings/public)
      { source: '/api/site-settings', headers: noStore },
      { source: `/:page(${privatePages})`, headers: noStore },
      { source: `/:page(${privatePages})/:rest*`, headers: noStore },
      { source: '/admin', headers: noIndexNoFollow },
      { source: '/admin/:path*', headers: noIndexNoFollow },
    ]
  },
  // Disable powered by header
  poweredByHeader: false,
};

export default nextConfig;
