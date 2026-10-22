'use client'

/**
 * Full-screen image viewer for the product gallery (loaded on demand). Scroll-snap track for
 * swiping, arrow keys and buttons for navigation, click/tap to zoom 2.5x (the zoomed image follows
 * the pointer; drag to pan on touch), Escape or the close button to leave. Focus is trapped inside.
 *
 * Images: a slide gets its <img> when it is the current one or a neighbour (loading="lazy" does nothing
 * inside the horizontal track). With image variants the slides use the 1200w WebP (srcset 400/800/1200)
 * and only the zoomed slide switches to the original; the thumbnails use the 200w variant. Every image
 * falls back once to the original (FallbackImage). Without variants all of these are the originals.
 */
import * as React from 'react'
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import { useDialog } from './useDialog'

export interface GalleryLightboxProps {
    images: string[]
    name: string
    startIndex: number
    onClose: (lastIndex: number) => void
}

const ZOOM = 2.5

/** The slide fills the dialog (minus 16/32 px padding): the srcset picks 400/800/1200 for it. */
const SLIDE_SIZES = '100vw'

/** The current slide and its neighbours (the arrows and keys wrap around). */
function around(i: number, count: number): number[] {
    return [i, (i + 1) % count, (i - 1 + count) % count]
}

export default function GalleryLightbox({ images, name, startIndex, onClose }: GalleryLightboxProps) {
    const count = images.length
    const [index, setIndex] = React.useState(startIndex)
    const [zoomed, setZoomed] = React.useState(false)
    // Slides that have their <img>: grows as the visitor moves, never shrinks (no re-download, no flash)
    const [seen, setSeen] = React.useState<ReadonlySet<number>>(() => new Set(around(startIndex, count)))
    if (around(index, count).some(i => !seen.has(i))) setSeen(new Set([...seen, ...around(index, count)]))
    const [origin, setOrigin] = React.useState({ x: 50, y: 50 })
    const trackRef = React.useRef<HTMLDivElement>(null)
    const drag = React.useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null)
    const indexRef = React.useRef(index)
    indexRef.current = index

    const close = React.useCallback(() => onClose(indexRef.current), [onClose])
    const panelRef = useDialog(true, close)

    // Start at the image that was clicked
    React.useLayoutEffect(() => {
        const track = trackRef.current
        if (track) track.scrollLeft = startIndex * track.clientWidth
    }, [startIndex])

    React.useEffect(() => {
        const track = trackRef.current
        if (!track) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => setIndex(Math.max(0, Math.min(count - 1, Math.round(track.scrollLeft / (track.clientWidth || 1))))))
        }
        track.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            track.removeEventListener('scroll', onScroll)
        }
    }, [count])

    const goTo = React.useCallback((i: number) => {
        const track = trackRef.current
        if (!track || count < 2) return
        const next = (i + count) % count
        setZoomed(false)
        track.scrollTo({ left: next * track.clientWidth, behavior: 'auto' })
        setIndex(next)
    }, [count])

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(indexRef.current + 1) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(indexRef.current - 1) }
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [goTo])

    const pointToOrigin = (e: React.PointerEvent<HTMLElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        return {
            x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
            y: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
        }
    }

    const onPointerDown = (e: React.PointerEvent<HTMLElement>) => {
        drag.current = { x: e.clientX, y: e.clientY, ox: origin.x, oy: origin.y, moved: false }
    }
    const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
        if (!zoomed) return
        if (e.pointerType === 'mouse') {
            setOrigin(pointToOrigin(e))
            return
        }
        const d = drag.current
        if (!d) return
        const rect = e.currentTarget.getBoundingClientRect()
        const dx = ((e.clientX - d.x) / rect.width) * 100
        const dy = ((e.clientY - d.y) / rect.height) * 100
        if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true
        setOrigin({ x: Math.max(0, Math.min(100, d.ox - dx / (ZOOM - 1))), y: Math.max(0, Math.min(100, d.oy - dy / (ZOOM - 1))) })
    }
    const onClickImage = (e: React.MouseEvent<HTMLElement>) => {
        if (drag.current?.moved) {
            drag.current = null
            return
        }
        drag.current = null
        if (zoomed) {
            setZoomed(false)
            return
        }
        const rect = e.currentTarget.getBoundingClientRect()
        setOrigin({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 })
        setZoomed(true)
    }

    return (
        <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} - görseller`}
            tabIndex={-1}
            className="fixed inset-0 z-[60] flex flex-col bg-white outline-none"
        >
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-2 sm:px-4">
                <p className="min-w-0 truncate px-2 text-sm font-semibold text-ink">
                    <span className="tabular-nums" aria-live="polite">{index + 1} / {count}</span>
                    <span className="ml-2 hidden font-normal text-muted sm:inline">{name}</span>
                </p>
                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={() => setZoomed(z => !z)}
                        aria-pressed={zoomed}
                        aria-label={zoomed ? 'Uzaklaştır' : 'Yakınlaştır'}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
                    >
                        {zoomed ? <ZoomOut className="h-5 w-5" aria-hidden="true" /> : <ZoomIn className="h-5 w-5" aria-hidden="true" />}
                    </button>
                    <button
                        type="button"
                        data-autofocus
                        onClick={close}
                        aria-label="Kapat"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-surface-2"
                    >
                        <X className="h-6 w-6" aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div className="relative min-h-0 flex-1">
                <div
                    ref={trackRef}
                    className={cn('no-scrollbar flex h-full snap-x snap-mandatory overscroll-contain', zoomed ? 'overflow-hidden' : 'overflow-x-auto')}
                >
                    {images.map((img, i) => (
                        <div key={`${img}-${i}`} className="flex h-full w-full shrink-0 snap-center items-center justify-center overflow-hidden p-4 sm:p-8">
                            <div
                                onPointerDown={onPointerDown}
                                onPointerMove={onPointerMove}
                                onClick={onClickImage}
                                className={cn('relative h-full w-full touch-pan-x', zoomed && i === index ? 'cursor-zoom-out touch-none' : 'cursor-zoom-in')}
                            >
                                {seen.has(i) && (
                                    <FallbackImage
                                        // Zoomed: the original (full resolution); the 1200w variant stays on screen until it has loaded
                                        src={zoomed && i === index ? originalImageUrl(img) : productImageUrl(img, 1200)}
                                        srcSet={zoomed && i === index ? undefined : productImageSrcSet(img, [400, 800, 1200])}
                                        sizes={SLIDE_SIZES}
                                        fallbackSrc={originalImageUrl(img)}
                                        alt={`${name} - görsel ${i + 1}`}
                                        width={1200}
                                        height={1200}
                                        draggable={false}
                                        className="pointer-events-none h-full w-full select-none object-contain transition-transform duration-200 ease-out"
                                        style={zoomed && i === index ? { transform: `scale(${ZOOM})`, transformOrigin: `${origin.x}% ${origin.y}%` } : undefined}
                                    />
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {count > 1 && (
                    <>
                        <button
                            type="button"
                            onClick={() => goTo(index - 1)}
                            aria-label="Önceki görsel"
                            className="absolute left-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-ink shadow-raised hover:bg-white sm:left-4"
                        >
                            <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={() => goTo(index + 1)}
                            aria-label="Sonraki görsel"
                            className="absolute right-2 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-ink shadow-raised hover:bg-white sm:right-4"
                        >
                            <ChevronRight className="h-6 w-6" aria-hidden="true" />
                        </button>
                    </>
                )}
            </div>

            {count > 1 && (
                <div className="no-scrollbar flex shrink-0 justify-center gap-2 overflow-x-auto border-t border-line px-4 py-3">
                    {images.map((img, i) => (
                        <button
                            key={`${img}-${i}`}
                            type="button"
                            onClick={() => goTo(i)}
                            aria-label={`Görsel ${i + 1}`}
                            aria-current={i === index ? 'true' : undefined}
                            className={cn(
                                'h-14 w-14 shrink-0 overflow-hidden rounded-thumb border bg-white',
                                i === index ? 'border-brand-600 ring-2 ring-brand-600' : 'border-line',
                            )}
                        >
                            <FallbackImage src={productImageUrl(img, 200)} fallbackSrc={originalImageUrl(img)} alt="" width={56} height={56} loading="lazy" className="h-full w-full object-contain p-1" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
