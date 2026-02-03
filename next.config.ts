import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
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
  // Headers for security and caching
  async headers() {
    return [
      {
        // Static assets - cache for 1 year
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      },
      {
        // Images - cache for 1 week
        source: '/api/images/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=604800, stale-while-revalidate=86400'
          }
        ]
      },
      {
        // All pages - allow CDN caching with stale-while-revalidate
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=120, stale-while-revalidate=300'
          }
        ]
      }
    ]
  },
  // Disable powered by header
  poweredByHeader: false,
};

export default nextConfig;
