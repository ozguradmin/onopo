import * as React from 'react'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import type { GuideImage } from '@/lib/guides'
import { cn } from '@/lib/utils'

/**
 * A guide's picture: up to three of our own product photos on white tiles, fanned out on a light brand panel (the
 * home campaign artwork style, components/home/CampaignBanners). The panel has a fixed aspect ratio, so the page
 * never shifts while the photos load; each photo's alt is the product's short name (lib/guides selectGuideImages).
 *
 *   hero   the guide's header picture (2:1, 5:2 from sm), eager: it is near the top of the article
 *   card   the top of a guide card (2:1), lazy unless `eager`
 */
const VARIANTS = {
    hero: {
        box: 'aspect-[2/1] rounded-sheet sm:aspect-[5/2]',
        tile: 'w-[30%] sm:w-[23%]',
        sizes: '(min-width: 1024px) 180px, (min-width: 640px) 23vw, 30vw',
        widths: [200, 400],
    },
    card: {
        box: 'aspect-[2/1] rounded-card',
        tile: 'w-[30%]',
        sizes: '(min-width: 1024px) 120px, (min-width: 640px) 15vw, 30vw',
        widths: [200, 400],
    },
} as const

export function GuideArt({
    images,
    variant,
    eager = false,
    className,
}: {
    images: readonly GuideImage[]
    variant: keyof typeof VARIANTS
    eager?: boolean
    className?: string
}) {
    if (!images.length) return null
    const v = VARIANTS[variant]
    const shown = images.slice(0, 3)
    const tilt = shown.length >= 3 ? ['-rotate-6', 'rotate-0', 'rotate-6'] : shown.length === 2 ? ['-rotate-3', 'rotate-3'] : ['rotate-0']
    return (
        // isolate: the raised middle tile (z-[1]) stays inside this picture, under a card's stretched title link
        <div className={cn('relative isolate overflow-hidden bg-linear-to-br from-brand-50 via-brand-50 to-surface', v.box, className)}>
            <span aria-hidden="true" className="absolute -right-[8%] -top-[40%] aspect-square w-[55%] rounded-full bg-white/70 blur-2xl" />
            <span aria-hidden="true" className="absolute -bottom-[45%] -left-[10%] aspect-square w-[45%] rounded-full bg-white/60 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center">
                {shown.map((img, i) => (
                    <span
                        key={img.image}
                        className={cn(
                            'relative aspect-square shrink-0 overflow-hidden rounded-card bg-white shadow-raised',
                            v.tile,
                            i > 0 && '-ml-[5%]',
                            shown.length >= 3 && i === 1 && 'z-[1] scale-110',
                            tilt[i],
                        )}
                    >
                        <FallbackImage
                            src={productImageUrl(img.image, 200)}
                            srcSet={productImageSrcSet(img.image, v.widths)}
                            sizes={v.sizes}
                            fallbackSrc={originalImageUrl(img.image)}
                            alt={img.alt}
                            width={200}
                            height={200}
                            loading={eager ? 'eager' : 'lazy'}
                            className="h-full w-full object-contain p-[8%]"
                        />
                    </span>
                ))}
            </div>
        </div>
    )
}

/** One product photo on a small white tile (the compact guide lists), decorative next to the guide title. */
export function GuideThumb({ image, className }: { image: GuideImage; className?: string }) {
    return (
        <span className={cn('relative block aspect-square shrink-0 overflow-hidden rounded-thumb bg-white shadow-card', className)} aria-hidden="true">
            <FallbackImage
                src={productImageUrl(image.image, 200)}
                srcSet={productImageSrcSet(image.image, [200])}
                sizes="48px"
                fallbackSrc={originalImageUrl(image.image)}
                alt=""
                width={48}
                height={48}
                loading="lazy"
                className="h-full w-full object-contain p-[10%]"
            />
        </span>
    )
}
