'use client'

/**
 * The pictures in a ProductCard's image well (spec §9: desktop hover crossfades to the second image).
 *
 * The main image renders exactly as before (eager/high for the first cards, lazy otherwise). The second
 * ("hover") image gets no <img> and so no request until a mouse or pen first enters the card on a desktop
 * layout: in the 1024px+ grid it used to be display:block at opacity 0 inside the viewport, so "lazy" did
 * not defer it and every page downloaded one hidden picture per card. The main image only fades out once
 * the second one has loaded, so a slow image never leaves the well empty.
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'

export interface ProductCardImagesProps {
    main: string | null
    second: string | null
    alt: string
    sizes: string
    /** eager + fetchpriority=high */
    priority?: boolean
    /** eager with the browser's normal priority */
    eager?: boolean
    soldOut?: boolean
    /** Less white padding around the photo (compact home cards: the packshots already have margins). */
    tight?: boolean
}

const IMG = 'absolute inset-0 h-full w-full object-contain p-[8%] transition-opacity duration-200'

export function ProductCardImages({ main, second, alt, sizes, priority = false, eager = false, soldOut = false, tight = false }: ProductCardImagesProps) {
    const ref = React.useRef<HTMLImageElement>(null)
    const [hover, setHover] = React.useState<'off' | 'loading' | 'ready'>('off')

    React.useEffect(() => {
        if (!second) return
        const card = ref.current?.closest('article') ?? ref.current?.parentElement
        if (!card) return
        const desktop = window.matchMedia('(min-width: 1024px)')
        const onEnter = (e: PointerEvent) => {
            // Touch never hovers (a tap opens the product); below 1024px the hover image is not shown
            if (e.pointerType === 'touch' || !desktop.matches) return
            setHover(h => (h === 'off' ? 'loading' : h))
        }
        card.addEventListener('pointerenter', onEnter)
        return () => card.removeEventListener('pointerenter', onEnter)
    }, [second])

    const crossfade = second != null && hover === 'ready'

    return (
        <>
            <FallbackImage
                ref={ref}
                src={productImageUrl(main, 400)}
                srcSet={productImageSrcSet(main, [200, 400, 800])}
                sizes={sizes}
                fallbackSrc={originalImageUrl(main)}
                alt={alt}
                width={400}
                height={400}
                loading={priority || eager ? 'eager' : 'lazy'}
                fetchPriority={priority ? 'high' : undefined}
                className={cn(IMG, tight && 'p-[3%]', crossfade && 'lg:group-hover:opacity-0', soldOut && 'opacity-50')}
            />
            {second && hover !== 'off' && (
                <FallbackImage
                    src={productImageUrl(second, 400)}
                    srcSet={productImageSrcSet(second, [200, 400, 800])}
                    sizes={sizes}
                    fallbackSrc={originalImageUrl(second)}
                    placeholderSrc={null}
                    alt=""
                    aria-hidden="true"
                    width={400}
                    height={400}
                    onLoad={() => setHover('ready')}
                    className={cn(IMG, tight && 'p-[3%]', 'hidden opacity-0 lg:block', crossfade && (soldOut ? 'lg:group-hover:opacity-50' : 'lg:group-hover:opacity-100'))}
                />
            )}
        </>
    )
}

export default ProductCardImages
