'use client'

/**
 * Product gallery (spec §11): a native scroll-snap track (swipe on touch, no JS needed to swipe),
 * thumbnails (row below the image at md/lg, vertical rail at xl), dots + "1/3" counter on mobile,
 * prev/next buttons from md, and a lightweight lightbox with tap/click zoom.
 *
 * The first image is the LCP: eager, fetchpriority=high, real width/height. Every other image is lazy.
 * Images fall back once to the original URL and then to the placeholder (FallbackImage): no retry loop.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'

const GalleryLightbox = React.lazy(() => import('./GalleryLightbox'))

export interface ProductGalleryProps {
    images: string[]
    name: string
    /** Badges over the image ("Tükendi"; the discount is shown next to the price), rendered on the server. */
    badges?: React.ReactNode
    soldOut?: boolean
}

const MAIN_SIZES = '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 620px'

export function ProductGallery({ images: rawImages, name, badges, soldOut = false }: ProductGalleryProps) {
    const images = rawImages.length ? rawImages : ['']
    const count = images.length
    const multi = count > 1
    const trackRef = React.useRef<HTMLDivElement>(null)
    const [index, setIndex] = React.useState(0)
    const [lightbox, setLightbox] = React.useState<number | null>(null)

    // Active slide follows the scroll position (swipe, buttons, thumbnails, keyboard)
    React.useEffect(() => {
        const track = trackRef.current
        if (!track || !multi) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const w = track.clientWidth || 1
                setIndex(Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / w))))
            })
        }
        track.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            track.removeEventListener('scroll', onScroll)
        }
    }, [count, multi])

    const goTo = React.useCallback((i: number, smooth = true) => {
        const track = trackRef.current
        if (!track) return
        const next = (i + count) % count
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        track.scrollTo({ left: next * track.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' })
        setIndex(next)
    }, [count])

    const openLightbox = (i: number) => {
        if (!images[i]) return
        setLightbox(i)
    }

    // Back from the lightbox: show the image the visitor ended on and focus its button
    const closeLightbox = React.useCallback((last: number) => {
        setLightbox(null)
        goTo(last, false)
        requestAnimationFrame(() => {
            trackRef.current?.querySelectorAll<HTMLButtonElement>('button')[last]?.focus({ preventScroll: true })
        })
    }, [goTo])

    return (
        <div className={cn('flex flex-col', multi && 'xl:grid xl:grid-cols-[64px_minmax(0,1fr)] xl:gap-4')} role="region" aria-label="Ürün görselleri">
            {/* Thumbnails: vertical rail at xl (first column), row below the image at md/lg */}
            {multi && (
                <div className="order-2 hidden md:mt-3 md:block xl:order-1 xl:mt-0">
                    <ul className="no-scrollbar flex gap-2 overflow-x-auto xl:max-h-[620px] xl:flex-col xl:overflow-y-auto xl:overflow-x-hidden" aria-label="Küçük görseller">
                        {images.map((img, i) => (
                            <li key={`${img}-${i}`} className="shrink-0">
                                <button
                                    type="button"
                                    onClick={() => goTo(i)}
                                    aria-label={`Görsel ${i + 1}`}
                                    aria-current={i === index ? 'true' : undefined}
                                    className={cn(
                                        'relative block h-16 w-16 overflow-hidden rounded-thumb border bg-white transition-[border-color,box-shadow] duration-150',
                                        i === index ? 'border-brand-600 ring-1 ring-inset ring-brand-600' : 'border-line hover:border-line-strong',
                                    )}
                                >
                                    <FallbackImage
                                        src={productImageUrl(img, 200)}
                                        fallbackSrc={originalImageUrl(img)}
                                        alt=""
                                        width={64}
                                        height={64}
                                        loading="lazy"
                                        className="h-full w-full object-contain p-1"
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="order-1 xl:order-2">
                {/* Full-bleed on phones, framed card from md */}
                <div className="relative -mx-4 md:mx-0">
                    <div
                        ref={trackRef}
                        tabIndex={multi ? 0 : -1}
                        onKeyDown={e => {
                            if (!multi) return
                            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(index + 1) }
                            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(index - 1) }
                        }}
                        role={multi ? 'group' : undefined}
                        aria-label={multi ? 'Görseller, kaydırarak veya ok tuşlarıyla değiştirin' : undefined}
                        className={cn(
                            'no-scrollbar flex aspect-square w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-white',
                            'border-b border-line md:rounded-sheet md:border',
                            multi ? 'focus-visible:outline-offset-[-2px]' : 'overflow-hidden',
                        )}
                    >
                        {images.map((img, i) => (
                            <div key={`${img}-${i}`} role="group" aria-roledescription="slayt" aria-label={`${i + 1} / ${count}`} className="relative h-full w-full shrink-0 snap-center snap-always">
                                <button
                                    type="button"
                                    onClick={() => openLightbox(i)}
                                    tabIndex={i === index ? 0 : -1}
                                    aria-label={`Görseli büyüt: ${name} - görsel ${i + 1}`}
                                    className="group/zoom block h-full w-full cursor-zoom-in focus-visible:outline-offset-[-4px]"
                                >
                                    <FallbackImage
                                        src={productImageUrl(img, 1200)}
                                        srcSet={productImageSrcSet(img, [400, 800, 1200])}
                                        sizes={MAIN_SIZES}
                                        fallbackSrc={originalImageUrl(img)}
                                        alt={count > 1 ? `${name} - görsel ${i + 1}` : name}
                                        width={800}
                                        height={800}
                                        loading={i === 0 ? 'eager' : 'lazy'}
                                        fetchPriority={i === 0 ? 'high' : undefined}
                                        draggable={false}
                                        className={cn('h-full w-full object-contain p-[6%] md:p-[8%]', soldOut && 'opacity-60')}
                                    />
                                </button>
                            </div>
                        ))}
                    </div>

                    {badges && <div className="pointer-events-none absolute left-4 top-4 z-[1] flex flex-col items-start gap-1.5 md:left-4">{badges}</div>}

                    {images[0] && (
                        <span className="pointer-events-none absolute right-4 top-4 hidden h-9 w-9 items-center justify-center rounded-full bg-white/90 text-ink-2 shadow-card md:inline-flex" aria-hidden="true">
                            <Expand className="h-4 w-4" />
                        </span>
                    )}

                    {multi && (
                        <>
                            <button
                                type="button"
                                onClick={() => goTo(index - 1)}
                                aria-label="Önceki görsel"
                                className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-ink shadow-raised transition-colors hover:bg-white md:inline-flex"
                            >
                                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <button
                                type="button"
                                onClick={() => goTo(index + 1)}
                                aria-label="Sonraki görsel"
                                className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-ink shadow-raised transition-colors hover:bg-white md:inline-flex"
                            >
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <span className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-ink/75 px-2.5 py-1 text-xs font-semibold tabular-nums text-white md:hidden" aria-hidden="true">
                                {index + 1}/{count}
                            </span>
                        </>
                    )}
                </div>

                {/* Dots (phones) */}
                {multi && (
                    <div className="mt-3 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
                        {images.map((_, i) => (
                            <span
                                key={i}
                                className={cn('h-1.5 rounded-full transition-all duration-200', i === index ? 'w-5 bg-ink' : 'w-1.5 bg-line-strong')}
                            />
                        ))}
                    </div>
                )}
                <p className="sr-only" aria-live="polite">{multi ? `Görsel ${index + 1} / ${count}` : ''}</p>
            </div>

            {lightbox !== null && (
                <React.Suspense fallback={null}>
                    <GalleryLightbox images={images} name={name} startIndex={lightbox} onClose={closeLightbox} />
                </React.Suspense>
            )}
        </div>
    )
}

export default ProductGallery
