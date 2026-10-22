'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { cn } from '@/lib/utils'
import { isNoindexListingHref } from '@/components/layout/nav-data'

export interface HeroCarouselSlide {
    id: number
    title: string
    subtitle: string
    buttonText: string
    /** Already normalised (internal paths end with "/"). */
    href: string
    /** Display URL (resized variant when available) and the original as the one-shot fallback. */
    image: string
    imageSrcSet?: string
    imageFallback: string
}

function isInternal(href: string) {
    return href.startsWith('/') && !href.startsWith('//')
}

function prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

const SIZES = '(max-width: 1023px) calc(100vw - 32px), 800px'

const LINK_CLASS =
    'inline-flex h-11 items-center gap-2 rounded-card bg-white px-4 text-sm font-semibold text-ink transition-colors duration-150 hover:bg-surface lg:h-12 lg:px-5 lg:text-[15px]'

/** Internal targets navigate client-side (nofollow to noindex listing variants); external ones stay plain anchors. */
function SlideLink({ href, children }: { href: string; children: React.ReactNode }) {
    if (isInternal(href)) {
        return (
            <Link href={href} prefetch={false} rel={isNoindexListingHref(href) ? 'nofollow' : undefined} className={LINK_CLASS}>
                {children}
            </Link>
        )
    }
    return (
        <a href={href} className={LINK_CLASS}>
            {children}
        </a>
    )
}

/**
 * Home hero slider (Admin › Ana Sayfa › Hero slides). CSS scroll-snap, swipeable, prev/next and dots,
 * NO autoplay. The first slide is in the server HTML with fetchpriority=high (LCP); the other slides'
 * images are requested only after the visitor interacts with the slider (hover, touch, focus, scroll),
 * so a multi-MB second banner never costs a mobile visitor who does not swipe.
 */
export function HeroCarousel({
    slides,
    priority = true,
    className,
}: {
    slides: HeroCarouselSlide[]
    /** First slide is the LCP image (eager + fetchpriority=high). False when the slider sits below the fold. */
    priority?: boolean
    className?: string
}) {
    const listRef = React.useRef<HTMLUListElement>(null)
    const [active, setActive] = React.useState(0)
    const [armed, setArmed] = React.useState(false)
    const count = slides.length
    const arm = React.useCallback(() => setArmed(true), [])

    React.useEffect(() => {
        const el = listRef.current
        if (!el || count < 2) return
        let frame = 0
        const onScroll = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(() => {
                const w = el.clientWidth || 1
                const i = Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / w)))
                setActive(i)
                if (el.scrollLeft > 2) setArmed(true)
            })
        }
        el.addEventListener('scroll', onScroll, { passive: true })
        return () => {
            cancelAnimationFrame(frame)
            el.removeEventListener('scroll', onScroll)
        }
    }, [count])

    const goTo = (i: number) => {
        const el = listRef.current
        if (!el) return
        setArmed(true)
        const target = (i + count) % count
        el.scrollTo({ left: target * el.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }

    return (
        <div
            // Whole-pixel width: a fractional slide width would leave a 1px sliver of the previous slide
            className={cn('group/hero relative h-full w-[round(down,100%,1px)] overflow-hidden rounded-sheet bg-ink-2', className)}
            onPointerEnter={count > 1 ? arm : undefined}
            onTouchStart={count > 1 ? arm : undefined}
            onFocusCapture={count > 1 ? arm : undefined}
        >
            <ul
                ref={listRef}
                className="no-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
                aria-label="Kampanyalar"
            >
                {slides.map((s, i) => {
                    const showImage = i === 0 || armed
                    return (
                        <li
                            key={s.id}
                            className="relative h-full w-full shrink-0 snap-start snap-always"
                            aria-roledescription="slayt"
                            aria-label={`${i + 1} / ${count}`}
                        >
                            {showImage && (
                                <FallbackImage
                                    src={s.image}
                                    srcSet={s.imageSrcSet}
                                    sizes={s.imageSrcSet ? SIZES : undefined}
                                    fallbackSrc={s.imageFallback}
                                    placeholderSrc={null}
                                    alt={s.title}
                                    width={1200}
                                    height={800}
                                    loading={i === 0 && !priority ? 'lazy' : 'eager'}
                                    fetchPriority={i === 0 ? (priority ? 'high' : undefined) : 'low'}
                                    className="absolute inset-0 h-full w-full object-cover"
                                />
                            )}
                            {/* Readability scrim: bottom-up on phones (text sits low), left-to-right from lg */}
                            <div
                                aria-hidden="true"
                                className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/40 to-ink/0 lg:bg-linear-to-r lg:from-ink/80 lg:via-ink/45 lg:to-ink/0"
                            />
                            <div className="relative flex h-full max-w-[560px] flex-col justify-end p-4 pb-5 sm:p-6 lg:justify-center lg:p-10">
                                {s.title && (
                                    <p className="text-[22px] leading-7 font-extrabold tracking-[-0.02em] text-white text-balance sm:text-[28px] sm:leading-[34px] lg:text-[40px] lg:leading-[48px]">
                                        {s.title}
                                    </p>
                                )}
                                {s.subtitle && (
                                    <p className="mt-2 hidden max-w-[440px] text-[15px] leading-6 text-white/85 line-clamp-2 sm:block lg:mt-3 lg:text-base">
                                        {s.subtitle}
                                    </p>
                                )}
                                {s.buttonText && (
                                    <div className="mt-3 lg:mt-6">
                                        <SlideLink href={s.href}>
                                            {s.buttonText}
                                            <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                        </SlideLink>
                                    </div>
                                )}
                            </div>
                        </li>
                    )
                })}
            </ul>

            {count > 1 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1 lg:bottom-6 lg:right-6 lg:gap-2">
                    <button
                        type="button"
                        onClick={() => goTo(active - 1)}
                        aria-label="Önceki kampanya"
                        className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink transition-colors duration-150 hover:bg-white lg:inline-flex"
                    >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                    </button>
                    <div className="flex items-center">
                        {slides.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => goTo(i)}
                                aria-label={`${i + 1}. kampanyaya git`}
                                aria-current={i === active ? 'true' : undefined}
                                className="flex h-11 w-7 items-center justify-center lg:h-10"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'h-1.5 rounded-full transition-all duration-200',
                                        i === active ? 'w-5 bg-white' : 'w-2.5 bg-white/55',
                                    )}
                                />
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => goTo(active + 1)}
                        aria-label="Sonraki kampanya"
                        className="hidden h-10 w-10 items-center justify-center rounded-full bg-white/90 text-ink transition-colors duration-150 hover:bg-white lg:inline-flex"
                    >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    )
}

export default HeroCarousel
