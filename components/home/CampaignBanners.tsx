import * as React from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { isNoindexListingHref } from '@/components/layout/nav-data'
import { cn } from '@/lib/utils'
import type { Campaign, CampaignTheme } from '@/lib/campaigns'
import type { HeroSlide } from '@/lib/catalog'
import { originalImageUrl, productImageSrcSet, productImageUrl } from '@/lib/images'
import { normalizeHref } from '@/lib/home-data'
import { CampaignCarousel } from './CampaignCarousel'

type SlideTheme = CampaignTheme | 'photo'

interface BannerSlide {
    key: string
    theme: SlideTheme
    kicker?: string
    title: string
    /** Big price under the title (live, e.g. the 9D line's single price). */
    highlight?: string
    subtitle?: string
    cta?: string
    href: string
    /** The link's accessible name (the printed text for a photo with text). */
    label: string
    image?: { src: string; srcSet?: string; fallback?: string; focusX?: string; hasText: boolean }
    /** Product photos for the built-in artwork (no image). */
    productImages: string[]
}

/** Banner colours. The photo prompts use the same palette, so the text colours work on both. */
const THEMES: Record<SlideTheme, { bg: string; text: string; kicker: string; sub: string; cta: string; scrim: string; glow: string; accent: string }> = {
    sale: {
        bg: 'bg-[linear-gradient(115deg,#9F1239_0%,#DC2626_50%,#F97316_100%)]',
        text: 'text-white',
        kicker: 'bg-white text-[#B91C1C]',
        sub: 'text-white/85',
        cta: 'bg-white text-ink',
        scrim: 'from-[#9F1239]/85',
        glow: 'bg-[#FDBA74]/45',
        accent: 'text-white',
    },
    glass: {
        bg: 'bg-[linear-gradient(115deg,#F5FBFE_0%,#E3F3FB_50%,#A8DBF4_100%)]',
        text: 'text-ink',
        kicker: 'bg-ink text-white',
        sub: 'text-ink-2',
        cta: 'bg-ink text-white',
        scrim: 'from-[#F5FBFE]/90',
        glow: 'bg-white/70',
        accent: 'text-brand-600',
    },
    turbo: {
        bg: 'bg-[radial-gradient(60%_110%_at_78%_50%,#0E5A8A_0%,transparent_65%),linear-gradient(115deg,#0B1220_0%,#0B2340_55%,#0A3A66_100%)]',
        text: 'text-white',
        kicker: 'bg-[#00A3E0] text-white',
        sub: 'text-[#9FDCF5]',
        cta: 'bg-white text-ink',
        scrim: 'from-[#0B1220]/85',
        glow: 'bg-[#00A3E0]/35',
        accent: 'text-[#5CC8F0]',
    },
    shipping: {
        bg: 'bg-[linear-gradient(115deg,#FFF8EE_0%,#FDEFD9_50%,#D6EDFA_100%)]',
        text: 'text-ink',
        kicker: 'bg-brand-600 text-white',
        sub: 'text-ink-2',
        cta: 'bg-ink text-white',
        scrim: 'from-[#FFF8EE]/90',
        glow: 'bg-white/70',
        accent: 'text-brand-600',
    },
    photo: {
        bg: 'bg-ink-2',
        text: 'text-white',
        kicker: 'bg-white text-ink',
        sub: 'text-white/85',
        cta: 'bg-white text-ink',
        scrim: 'from-ink/80',
        glow: 'bg-white/10',
        accent: 'text-white',
    },
}

function fromCampaign(c: Campaign): BannerSlide {
    const photo = c.photo
    return {
        key: c.key,
        theme: c.theme,
        kicker: c.kicker,
        title: c.title,
        highlight: c.highlight,
        subtitle: c.subtitle || undefined,
        cta: c.cta,
        href: c.href,
        label: photo?.text || [[c.kicker && `${c.kicker}:`, c.title, c.highlight].filter(Boolean).join(' '), c.subtitle].filter(Boolean).join('. '),
        image: photo
            ? {
                src: `/kampanya/${photo.name}-1600.webp`,
                srcSet: `/kampanya/${photo.name}-800.webp 800w, /kampanya/${photo.name}-1600.webp 1600w`,
                focusX: photo.focusX,
                hasText: !!photo.text,
            }
            : undefined,
        productImages: c.productImages,
    }
}

function fromHeroSlide(s: HeroSlide): BannerSlide {
    return {
        key: `hero-${s.id}`,
        theme: 'photo',
        title: s.title,
        subtitle: s.subtitle || undefined,
        cta: s.button_text || (s.button_link ? 'İncele' : undefined),
        href: normalizeHref(s.button_link, '/products/'),
        label: [s.title, s.subtitle].filter(Boolean).join('. ') || 'Kampanya',
        image: { src: productImageUrl(s.image_url, 1200), srcSet: productImageSrcSet(s.image_url, [800, 1200]), fallback: originalImageUrl(s.image_url), hasText: false },
        productImages: [],
    }
}

/**
 * One whole banner at a time (owner: no edges of the neighbours). 2:1 on phones and tablets, 11:4 from lg so
 * the products still start high; the 16:9 photos keep their printed text inside the middle 70% (safe for both).
 */
const SLIDE_CLASS = 'relative w-full shrink-0 snap-start'
const IMAGE_SIZES = '(min-width: 1280px) 1216px, 100vw'

/** Product photos on white tiles, fanned out on the right half (until the campaign has its own photo). */
function Artwork({ images, glow, eager }: { images: string[]; glow: string; eager: boolean }) {
    const tilt = images.length >= 3 ? ['-rotate-6', 'rotate-0', 'rotate-6'] : ['-rotate-3', 'rotate-3']
    return (
        <span aria-hidden="true" className="absolute inset-0">
            <span className={cn('absolute -right-[8%] -top-[35%] aspect-square w-[55%] rounded-full blur-2xl', glow)} />
            <span className="absolute inset-y-0 right-0 flex w-[46%] items-center justify-center pr-[2%]">
                {images.map((src, i) => (
                    <span
                        key={src}
                        className={cn(
                            'relative aspect-square w-[52%] shrink-0 overflow-hidden rounded-card bg-white shadow-raised md:w-[40%]',
                            i > 0 && '-ml-[18%]',
                            i === 1 && 'z-[1] scale-110',
                            // Two tiles fit a phone banner; the third joins from md
                            i === 2 && 'hidden md:block',
                            tilt[i],
                        )}
                    >
                        <FallbackImage
                            src={productImageUrl(src, 200)}
                            srcSet={productImageSrcSet(src, [200, 400])}
                            sizes="(min-width: 1024px) 160px, (min-width: 768px) 120px, 90px"
                            fallbackSrc={originalImageUrl(src)}
                            placeholderSrc={null}
                            alt=""
                            width={200}
                            height={200}
                            loading={eager ? 'eager' : 'lazy'}
                            className="h-full w-full object-contain p-[8%]"
                        />
                    </span>
                ))}
            </span>
        </span>
    )
}

type Theme = (typeof THEMES)[SlideTheme]

/**
 * Text on a campaign photo, laid out like the printed banners (pill, two-line headline, big price,
 * button). Sizes are in container units, so the proportions are the same on a 340px phone banner and
 * a 600px desktop one; max() keeps the smallest text readable.
 */
function PosterText({ slide, t }: { slide: BannerSlide; t: Theme }) {
    return (
        <span aria-hidden="true" className={cn('relative flex h-full w-[44%] flex-col items-start justify-center pl-[3.6cqw]', t.text)}>
            {slide.kicker && (
                <span className={cn('rounded-full px-[1.8cqw] py-[0.7cqw] text-[max(10px,2.9cqw)] leading-none font-extrabold uppercase', t.kicker)}>{slide.kicker}</span>
            )}
            <span className="mt-[1.6cqw] text-[max(14px,5cqw)] leading-[1.02] font-extrabold tracking-[-0.035em] text-balance">{slide.title}</span>
            {slide.highlight ? (
                <span className={cn('mt-[1cqw] whitespace-nowrap text-[max(24px,9.4cqw)] leading-none font-extrabold tracking-[-0.045em]', t.accent)}>{slide.highlight}</span>
            ) : (
                slide.subtitle && <span className={cn('mt-[1.2cqw] text-[max(10px,2.5cqw)] leading-tight font-semibold', t.sub)}>{slide.subtitle}</span>
            )}
            {slide.cta && (
                <span className={cn('mt-[2.4cqw] inline-flex h-[max(26px,6.2cqw)] items-center gap-[1cqw] rounded-full px-[2.8cqw] text-[max(11px,3cqw)] font-bold transition-transform duration-150 group-hover:translate-x-0.5', t.cta)}>
                    {slide.cta}
                    <ArrowRight className="h-[1.1em] w-[1.1em]" aria-hidden="true" />
                </span>
            )}
        </span>
    )
}

/** Text on the built-in artwork (no photo): kicker, title, price or subtitle, button. */
function ArtworkText({ slide, t }: { slide: BannerSlide; t: Theme }) {
    return (
        <span aria-hidden="true" className={cn('relative flex h-full w-[58%] flex-col items-start justify-center gap-1.5 p-3.5 sm:p-5 lg:w-[56%] lg:gap-2 lg:p-6 xl:p-7', t.text)}>
            {slide.kicker && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] leading-4 font-bold uppercase tracking-[0.06em] sm:text-[11px] lg:px-2.5 lg:text-xs', t.kicker)}>
                    {slide.kicker}
                </span>
            )}
            <span className="text-[17px] leading-[21px] font-extrabold tracking-[-0.02em] text-balance sm:text-[22px] sm:leading-[27px] lg:text-[24px] lg:leading-[29px] xl:text-[28px] xl:leading-[33px]">
                {slide.title}
                {slide.highlight && <span className={cn('block', t.accent)}>{slide.highlight}</span>}
            </span>
            {slide.subtitle && (
                <span className={cn('hidden text-[11px] leading-[15px] font-medium min-[380px]:line-clamp-2 sm:text-[13px] sm:leading-[18px] lg:text-sm lg:leading-5', t.sub)}>
                    {slide.subtitle}
                </span>
            )}
            {slide.cta && (
                <span className={cn('mt-0.5 inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold transition-transform duration-150 group-hover:translate-x-0.5 sm:h-8 sm:text-[13px] lg:mt-1 lg:h-9 lg:px-4 lg:text-sm', t.cta)}>
                    {slide.cta}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
            )}
        </span>
    )
}

function Slide({ slide, index, count }: { slide: BannerSlide; index: number; count: number }) {
    const t = THEMES[slide.theme]
    const first = index === 0
    const img = slide.image
    return (
        <li className={SLIDE_CLASS} role="group" aria-roledescription="slayt" aria-label={`${index + 1} / ${count}`}>
            <Link
                href={slide.href}
                prefetch={false}
                // Listing variants (?sort=, ?f=) are noindex: nofollow, like the other links to them
                rel={isNoindexListingHref(slide.href) ? 'nofollow' : undefined}
                aria-label={slide.label}
                className={cn('group @container relative block aspect-[2/1] overflow-hidden rounded-sheet lg:aspect-[11/4] outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2', t.bg)}
            >
                {img ? (
                    <FallbackImage
                        src={img.src}
                        srcSet={img.srcSet}
                        sizes={img.srcSet ? IMAGE_SIZES : undefined}
                        fallbackSrc={img.fallback}
                        placeholderSrc={null}
                        alt=""
                        width={1600}
                        height={900}
                        loading={first ? 'eager' : 'lazy'}
                        fetchPriority={first ? 'high' : 'low'}
                        className="absolute inset-0 h-full w-full object-cover"
                        style={img.focusX ? { objectPosition: `${img.focusX} 50%` } : undefined}
                    />
                ) : (
                    <Artwork images={slide.productImages} glow={t.glow} eager={first} />
                )}

                {img && !img.hasText && (
                    <>
                        <span aria-hidden="true" className={cn('absolute inset-0 bg-linear-to-r via-transparent via-45% to-transparent', t.scrim)} />
                        <PosterText slide={slide} t={t} />
                    </>
                )}
                {!img && <ArtworkText slide={slide} t={t} />}
            </Link>
        </li>
    )
}

/**
 * "Kampanyalar" slider at the very top of the home page: the admin's Hero slides first (when the
 * owner switches the Hero section on), then the campaign banners built from live store data
 * (lib/campaigns). Server-rendered slides; CampaignCarousel adds the dots, arrows and autoplay.
 */
export function CampaignBanners({ campaigns, heroSlides = [], className }: { campaigns: Campaign[]; heroSlides?: HeroSlide[]; className?: string }) {
    const slides = [...heroSlides.map(fromHeroSlide), ...campaigns.map(fromCampaign)].slice(0, 6)
    if (!slides.length) return null
    return (
        <section aria-roledescription="carousel" aria-label="Kampanyalar" className={cn('container-store', className)}>
            <CampaignCarousel count={slides.length} label="Kampanyalar">
                {slides.map((s, i) => (
                    <Slide key={s.key} slide={s} index={i} count={slides.length} />
                ))}
            </CampaignCarousel>
        </section>
    )
}

export default CampaignBanners
