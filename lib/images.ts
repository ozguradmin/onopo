/**
 * Image URLs for the storefront (isomorphic: safe in Server and Client Components).
 *
 * Originals live in R2 and are stored in D1 as `/api/images/<key>` (or, for old rows, a full
 * `https://images.onopostore.com/<key>` / `https://pub-…r2.dev/<key>` URL). They are served from the
 * R2 custom domain https://images.onopostore.com/<key> (edge-cached, no Worker involved).
 *
 * Resized WebP variants follow ONE convention:
 *     https://images.onopostore.com/v/<width>/<key>.webp      width ∈ IMAGE_WIDTHS (200, 400, 800, 1200)
 * They are NOT uploaded yet, so `IMAGE_VARIANTS_ENABLED` is false and every helper returns the original
 * URL. Turn variants on with the build-time env var NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED=true once the
 * files exist. Client <img>s must still fall back to the original once on error (FallbackImage does).
 *
 * Feeds, JSON-LD and og:image keep using ORIGINAL urls (merchants want full-size images).
 */

export const R2_PUBLIC_HOST = 'https://images.onopostore.com'
const LEGACY_R2_HOST_RE = /^https?:\/\/pub-[a-z0-9]+\.r2\.dev\//i

/** Variant widths that exist (or will exist) under /v/<w>/. Never request other widths. */
export const IMAGE_WIDTHS = [200, 400, 800, 1200] as const
export type ImageWidth = (typeof IMAGE_WIDTHS)[number]

/** Flip with NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED=true at build time (inlined into client bundles). */
export const IMAGE_VARIANTS_ENABLED: boolean = process.env.NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED === 'true'

export const PLACEHOLDER_IMAGE = '/placeholder.svg'

/**
 * The R2 object key of a stored image reference, or null when it is not one of ours
 * (external URL, data: URI, local /public file).
 */
export function imageKey(url: string | null | undefined): string | null {
    if (!url) return null
    const u = url.trim()
    if (u.startsWith('/api/images/')) return decodeSafe(u.slice('/api/images/'.length)) || null
    if (u.startsWith(R2_PUBLIC_HOST + '/')) {
        const key = u.slice(R2_PUBLIC_HOST.length + 1)
        return key.startsWith('v/') ? null : decodeSafe(key) || null
    }
    if (LEGACY_R2_HOST_RE.test(u)) return decodeSafe(u.replace(LEGACY_R2_HOST_RE, '')) || null
    // A bare key ("1769…-name.png") as some old rows store it
    if (!u.startsWith('/') && !/^[a-z]+:/i.test(u)) return u
    return null
}

function decodeSafe(s: string): string {
    try { return decodeURIComponent(s.split('?')[0]) } catch { return s.split('?')[0] }
}

function encodeKey(key: string): string {
    return key.split('/').map(encodeURIComponent).join('/')
}

/**
 * Full-size URL for any stored image reference (same mapping as lib/utils getImageUrl):
 * R2 keys → https://images.onopostore.com/<key>; other http(s) URLs and local paths unchanged;
 * empty → /placeholder.svg.
 */
export function originalImageUrl(url: string | null | undefined): string {
    if (!url) return PLACEHOLDER_IMAGE
    const key = imageKey(url)
    if (key) return `${R2_PUBLIC_HOST}/${encodeKey(key)}`
    return url
}

/** Smallest variant width that is >= the requested width (largest if none). */
export function variantWidth(width: number): ImageWidth {
    for (const w of IMAGE_WIDTHS) if (w >= width) return w
    return IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1]
}

/**
 * URL to display an image at about `width` CSS px (pass the rendered slot width; the helper picks
 * the next variant). Returns the original while variants are disabled or for non-R2 images.
 */
export function productImageUrl(url: string | null | undefined, width: number = 400): string {
    const key = IMAGE_VARIANTS_ENABLED ? imageKey(url) : null
    if (!key) return originalImageUrl(url)
    return `${R2_PUBLIC_HOST}/v/${variantWidth(width)}/${encodeKey(key)}.webp`
}

/**
 * `srcset` for an R2 image ("…/v/200/k.webp 200w, …/v/400/k.webp 400w"), or undefined while
 * variants are disabled / the image is not in R2 (then render plain `src`).
 */
export function productImageSrcSet(url: string | null | undefined, widths: readonly number[] = [200, 400, 800]): string | undefined {
    const key = IMAGE_VARIANTS_ENABLED ? imageKey(url) : null
    if (!key) return undefined
    const unique = Array.from(new Set(widths.map(variantWidth)))
    return unique.map(w => `${R2_PUBLIC_HOST}/v/${w}/${encodeKey(key)}.webp ${w}w`).join(', ')
}

/** `sizes` for product cards in grids (2 cols mobile, 3 tablet, ~290px desktop). */
export const PRODUCT_CARD_SIZES = '(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 290px'

/** Absolute URL (for og:image / JSON-LD / icons): local paths get the site origin. */
export function absoluteImageUrl(url: string | null | undefined, origin: string = 'https://onopostore.com'): string {
    const full = originalImageUrl(url)
    if (/^https?:\/\//i.test(full)) return full
    return origin.replace(/\/$/, '') + (full.startsWith('/') ? full : '/' + full)
}
