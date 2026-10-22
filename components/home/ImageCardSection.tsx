import * as React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import { getImageSize, normalizeHref } from '@/lib/home-data'
import { isNoindexListingHref } from '@/components/layout/nav-data'

interface ImageCardSectionProps {
    title?: string
    /** Admin › Ana Sayfa › Görsel Kart: config.image_url (an /api/images/… ref, a URL or a data: URI). */
    image_url?: string
    /** config.link_url (optional; "/products" or "https://…"). */
    link_url?: string
    className?: string
}

const DEFAULT_TITLES = new Set(['yeni bölüm', 'görsel kart', ''])

/**
 * Admin banner (spec §8.5): radius 16, lazy-loaded, optional link. Banners usually carry text in the
 * image, so it is never cropped: with a known pixel size the image keeps its own aspect ratio (wide
 * banners span the container, others are centred, max 480px tall); without one it is contained in a
 * fixed 3:1 box. Either way the space is reserved up front (no layout shift). Server Component.
 */
export async function ImageCardSection({ title, image_url, link_url, className }: ImageCardSectionProps) {
    const src = (image_url ?? '').trim()
    if (!src) return null
    const label = title && !DEFAULT_TITLES.has(title.trim().toLocaleLowerCase('tr-TR')) ? title.trim() : ''
    const href = link_url && link_url.trim() ? normalizeHref(link_url) : null
    const size = await getImageSize(src)
    const wide = !size || size.width / size.height >= 2

    const imgProps = {
        alt: label,
        width: size?.width ?? 1216,
        height: size?.height ?? 405,
        loading: 'lazy' as const,
        decoding: 'async' as const,
        className: size ? 'block h-auto w-full' : 'absolute inset-0 h-full w-full object-contain',
    }
    // Narrow banners: centred, at most 480px tall (and never upscaled); the box width is definite, so
    // the height is reserved from the width/height ratio before the image loads.
    const boxStyle = size && !wide ? { width: `min(100%, ${Math.min(size.width, Math.round((480 * size.width) / size.height))}px)` } : undefined
    // An inline data: URI (older admin uploads) is rendered by the server only, so the (large) string
    // is not repeated in the client payload; stored images get the one-shot fallback island.
    const srcSet = productImageSrcSet(src, [800, 1200])
    const image = src.startsWith('data:') ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img src={src} {...imgProps} />
    ) : (
        <FallbackImage
            src={productImageUrl(src, 1200)}
            fallbackSrc={originalImageUrl(src)}
            srcSet={srcSet}
            sizes={srcSet ? '(max-width: 1279px) calc(100vw - 32px), 1216px' : undefined}
            {...imgProps}
        />
    )
    const box = cn(
        'group block overflow-hidden rounded-sheet transition-opacity duration-150 hover:opacity-95',
        !size && 'relative aspect-[3/1] bg-surface',
        size && (wide ? 'w-full' : 'mx-auto'),
    )

    return (
        <section className={cn('container-store', className)} aria-label={label || 'Kampanya'}>
            {href ? (
                /^https?:\/\//i.test(href) ? (
                    <a href={href} className={box} style={boxStyle} aria-label={label || 'Kampanyayı incele'}>
                        {image}
                    </a>
                ) : (
                    // A noindex listing variant (?sort=, ?f=, …) gets nofollow, like the menu links (docs/SEO.md §3)
                    <Link href={href} prefetch={false} rel={isNoindexListingHref(href) ? 'nofollow' : undefined} className={box} style={boxStyle} aria-label={label || 'Kampanyayı incele'}>
                        {image}
                    </Link>
                )
            ) : (
                <div className={box} style={boxStyle}>
                    {image}
                </div>
            )}
        </section>
    )
}

export default ImageCardSection
