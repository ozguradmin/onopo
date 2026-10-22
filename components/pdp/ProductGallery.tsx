'use client'

/**
 * Product gallery (spec §11): a native scroll-snap track (swipe on touch, no JS needed to swipe),
 * thumbnails (row below the image at md/lg, vertical rail at xl), dots + "1/3" counter on mobile,
 * prev/next buttons from md, and a lightweight lightbox with tap/click zoom. Phones get a 4:3 frame
 * (square from md) so the title, price and "Sepete Ekle" fit in the first screen.
 *
 * The first image is the LCP: eager, fetchpriority=high, real width/height. The other slides get an
 * <img> only when the visitor is about to see them (first swipe/touch, arrow, thumbnail, keyboard, mouse
 * over the gallery): loading="lazy" does nothing inside a horizontal scroller (Chrome loads every slide
 * within its distance threshold, 16 MB extra on the vacuum page). The slide boxes have a fixed size,
 * so a late image never shifts the layout. Thumbnails (md+) other than the first wait for the page load
 * plus idle time, or the first interaction.
 * Images fall back once to the original URL and then to the placeholder (FallbackImage): no retry loop.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { IMAGE_VARIANTS_ENABLED, originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'

const GalleryLightbox = React.lazy(() => import('./GalleryLightbox'))

export interface ProductGalleryProps {
    images: string[]
    name: string
    /** Badges over the image ("Tükendi"; the discount is shown next to the price), rendered on the server. */
    badges?: React.ReactNode
    soldOut?: boolean
}

const MAIN_SIZES = '(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 620px'

type IdleWindow = Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
}

/** Focus from the keyboard (a tap on a phone also focuses the button, but must not load the other slides). */
function isKeyboardFocus(el: EventTarget): boolean {
    try {
        return el instanceof Element && el.matches(':focus-visible')
    } catch {
        return true
    }
}

/** Runs `cb` once the page has loaded (LCP image included) and the main thread is idle. Returns a cancel function. */
function afterLoadIdle(cb: () => void): () => void {
    const w = window as IdleWindow
    let idleId: number | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    const run = () => {
        if (w.requestIdleCallback) idleId = w.requestIdleCallback(cb, { timeout: 3000 })
        else timer = setTimeout(cb, 1000)
    }
    if (document.readyState === 'complete') run()
    else window.addEventListener('load', run, { once: true })
    return () => {
        window.removeEventListener('load', run)
        if (idleId !== undefined) w.cancelIdleCallback?.(idleId)
        if (timer) clearTimeout(timer)
    }
}

export function ProductGallery({ images: rawImages, name, badges, soldOut = false }: ProductGalleryProps) {
    const images = rawImages.length ? rawImages : ['']
    const count = images.length
    const multi = count > 1
    const trackRef = React.useRef<HTMLDivElement>(null)
    const [index, setIndex] = React.useState(0)
    const [lightbox, setLightbox] = React.useState<number | null>(null)
    // Slides that have their <img> (the first one always: it is the LCP), and whether the thumbnails beyond the first may load
    const [wanted, setWanted] = React.useState<ReadonlySet<number>>(() => new Set([0]))
    const [thumbsArmed, setThumbsArmed] = React.useState(false)
    const indexRef = React.useRef(index)
    indexRef.current = index

    const want = React.useCallback((list: number[]) => {
        setWanted(prev => {
            let next: Set<number> | null = null
            for (const i of list) {
                if (i < 0 || i >= count || prev.has(i)) continue
                next ??= new Set(prev)
                next.add(i)
            }
            return next ?? prev
        })
    }, [count])
    // Arrows, keyboard and thumbnails wrap around (goTo), so their neighbours do too
    const wantAround = React.useCallback((i: number) => want([i, (i + 1) % count, (i - 1 + count) % count]), [want, count])
    const arm = React.useCallback(() => {
        if (!multi) return
        setThumbsArmed(true)
        wantAround(indexRef.current)
    }, [multi, wantAround])

    // Thumbnails (md+ only; hidden and never fetched on phones) load after the page did. With image variants
    // the next slide (a small WebP) is warmed too, so the first swipe shows it at once; without variants
    // the slides are multi-MB originals and wait for the visitor.
    React.useEffect(() => {
        if (!multi) return
        return afterLoadIdle(() => {
            if (window.matchMedia?.('(min-width: 768px)').matches) setThumbsArmed(true)
            if (IMAGE_VARIANTS_ENABLED) want([1])
        })
    }, [multi, want])

    // Active slide follows the scroll position (swipe, buttons, thumbnails, keyboard); the slides coming
    // into view and the next one in each direction get their image
    React.useEffect(() => {
        const track = trackRef.current
        if (!track || !multi) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const pos = track.scrollLeft / (track.clientWidth || 1)
                const current = Math.max(0, Math.min(count - 1, Math.round(pos)))
                want([Math.floor(pos), Math.ceil(pos), current + 1, current - 1])
                setIndex(current)
            })
        }
        track.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            track.removeEventListener('scroll', onScroll)
        }
    }, [count, multi, want])

    const goTo = React.useCallback((i: number, smooth = true) => {
        const track = trackRef.current
        if (!track) return
        const next = (i + count) % count
        wantAround(next)
        const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        track.scrollTo({ left: next * track.clientWidth, behavior: smooth && !reduce ? 'smooth' : 'auto' })
        setIndex(next)
    }, [count, wantAround])

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
        <div
            className={cn('flex flex-col', multi && 'xl:grid xl:grid-cols-[64px_minmax(0,1fr)] xl:gap-4')}
            role="region"
            aria-label="Ürün görselleri"
            // A mouse over the gallery or keyboard focus in it: the visitor is about to browse the images
            onPointerEnter={e => { if (e.pointerType === 'mouse') arm() }}
            onFocus={e => { if (isKeyboardFocus(e.target)) arm() }}
        >
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
                                    {(i === 0 || thumbsArmed) && (
                                        <FallbackImage
                                            src={productImageUrl(img, 200)}
                                            fallbackSrc={originalImageUrl(img)}
                                            alt=""
                                            width={64}
                                            height={64}
                                            loading="lazy"
                                            className="h-full w-full object-contain p-1"
                                        />
                                    )}
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
                        // A touch (or mouse press) on the track: the next swipe needs the neighbouring slides
                        onPointerDown={multi ? () => want([index + 1, index - 1]) : undefined}
                        role={multi ? 'group' : undefined}
                        aria-label={multi ? 'Görseller, kaydırarak veya ok tuşlarıyla değiştirin' : undefined}
                        className={cn(
                            // Phones: 4:3 (about 290 px at 390 wide) so title, price and the buy buttons fit in the first screen
                            'no-scrollbar flex aspect-[4/3] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-white md:aspect-square',
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
                                    {wanted.has(i) && (
                                        <FallbackImage
                                            src={productImageUrl(img, 1200)}
                                            srcSet={productImageSrcSet(img, [400, 800, 1200])}
                                            sizes={MAIN_SIZES}
                                            fallbackSrc={originalImageUrl(img)}
                                            alt={count > 1 ? `${name} - görsel ${i + 1}` : name}
                                            width={800}
                                            height={800}
                                            // Rendered only when wanted, so load now (a lazy <img> clipped by the
                                            // scroller would wait until it is on screen in Safari/Firefox)
                                            loading="eager"
                                            fetchPriority={i === 0 ? 'high' : undefined}
                                            draggable={false}
                                            className={cn('h-full w-full object-contain p-2 md:p-[8%]', soldOut && 'opacity-60')}
                                        />
                                    )}
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
                    <div className="mt-2 flex justify-center gap-1.5 md:hidden" aria-hidden="true">
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
