"use client"

/**
 * Store footer (spec §14, §15). Rendered once by the root shell (`fromShell`); legacy pages that render
 * <Footer /> themselves get nothing. Everything comes from server data (store-data context):
 *   trust band (shipping rule, PayTR, return window, support)
 *   brand + site_description + social links (when footer_social_visible)
 *   categories (footer_categories, else categories with products)
 *   customer service: CMS pages at /page/<slug>/, order tracking
 *   contact: footer_phone, whatsapp_number, footer_email, footer_address
 *   bottom bar: footer_text with the current year, payment marks, SSL note
 * On phones the link columns are accordions (links stay in the HTML for crawlers).
 * variant "checkout" (/odeme): trust band + bottom bar only.
 */
import * as React from "react"
import Link from "next/link"
import { ChevronDown, Facebook, Instagram, Linkedin, Lock, Mail, MapPin, MessageCircle, Phone, Twitter, Youtube } from "lucide-react"
import { cn } from "@/lib/utils"
import { FallbackImage } from "@/components/ui/FallbackImage"
import { useShellChrome, useStoreData } from "@/components/layout/store-data"
import { LOGO_SIZES, logoSources } from "./Header"
import { PaymentMarks, TrustBand } from "./trust"
import { SUPPORT_LINKS, telHref, whatsappHref } from "./nav-data"

export function Footer({ fromShell = false, variant = 'store' }: { fromShell?: boolean; variant?: 'store' | 'checkout' }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return <FooterInner variant={variant} />
}

/** "© 2025 Onopo. …" → the current year (the admin text keeps working, the year never goes stale). */
function footerText(raw: string, siteName: string): string {
    const year = new Date().getFullYear()
    const text = raw.trim()
    if (!text) return `© ${year} ${siteName}. Tüm hakları saklıdır.`
    return text.replace(/(©\s*)(19|20)\d{2}(?!\s*[-–]\s*\d)/, `$1${year}`)
}

function TikTok({ className }: { className?: string }) {
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5" />
            <path d="M14 3c.4 2.6 2.2 4.4 5 4.6" />
        </svg>
    )
}

function FooterInner({ variant }: { variant: 'store' | 'checkout' }) {
    const { settings: s, categories: allCategories } = useStoreData()
    const siteName = s.site_name || 'Onopo'
    const text = footerText(s.footer_text, siteName)
    const logo = logoSources(s.logo_url)

    const bottomBar = (
        <div className="border-t border-white/10">
            <div className="container-store flex flex-col gap-4 py-5 text-[13px] text-white/65 md:flex-row md:items-center md:justify-between">
                <p suppressHydrationWarning>{text}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <span className="inline-flex items-center gap-1.5">
                        <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                        256-bit SSL ile güvenli ödeme
                    </span>
                    <PaymentMarks tone="dark" />
                </div>
            </div>
        </div>
    )

    if (variant === 'checkout') {
        return (
            <footer className="mt-12">
                <TrustBand />
                <div className="bg-ink text-white">
                    <div className="container-store flex flex-wrap gap-x-5 gap-y-2 pt-5 text-[13px] text-white/75">
                        {SUPPORT_LINKS.filter(l => l.href.startsWith('/page/')).map(l => (
                            <Link key={l.href} href={l.href} prefetch={false} className="hover:text-white">
                                {l.label}
                            </Link>
                        ))}
                    </div>
                    {bottomBar}
                </div>
            </footer>
        )
    }

    // Admin-selected footer categories (by name), otherwise every category with products (max 6)
    const categories = s.footer_categories.length > 0
        ? allCategories.filter(c => s.footer_categories.includes(c.name))
        : allCategories.filter(c => c.product_count > 0).slice(0, 6)

    const socials = s.footer_social_visible
        ? [
            { label: 'Instagram', href: s.instagram_url, icon: Instagram },
            { label: 'Facebook', href: s.facebook_url, icon: Facebook },
            { label: 'X (Twitter)', href: s.twitter_url, icon: Twitter },
            { label: 'YouTube', href: s.youtube_url, icon: Youtube },
            { label: 'TikTok', href: s.tiktok_url, icon: TikTok },
            { label: 'LinkedIn', href: s.linkedin_url, icon: Linkedin },
        ].filter(x => /^https?:\/\//i.test((x.href || '').trim()))
        : []

    const whatsapp = whatsappHref(s.whatsapp_number)
    const hasContact = !!(s.footer_phone || s.footer_email || s.footer_address || whatsapp)

    return (
        <footer className="mt-12 lg:mt-16">
            <TrustBand />
            <div className="bg-ink text-white">
                <div className="container-store grid gap-x-8 gap-y-2 py-8 lg:grid-cols-12 lg:gap-y-8 lg:py-14">
                    {/* Brand */}
                    <div className="pb-4 lg:col-span-4 lg:pb-0 lg:pr-8">
                        <Link href="/" prefetch={false} aria-label={`${siteName} ana sayfa`} className="inline-flex rounded-thumb">
                            {logo.length > 0 ? (
                                // Black wordmark → white, the cyan "STORE" keeps its hue (invert + 180° hue rotation).
                                // Same URLs as the header logo (variant, then the original once), so it is one download.
                                <FallbackImage
                                    src={logo[0].src}
                                    srcSet={logo[0].srcSet}
                                    sizes={LOGO_SIZES}
                                    fallbackSrc={logo[1]?.src}
                                    placeholderSrc={null}
                                    alt={`${siteName} Store`}
                                    width={1080}
                                    height={216}
                                    loading="lazy"
                                    className="h-8 w-auto [filter:invert(1)_hue-rotate(180deg)_saturate(1.4)]"
                                />
                            ) : (
                                <span className="text-2xl font-extrabold tracking-tight">{siteName}</span>
                            )}
                        </Link>
                        {s.site_description && <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">{s.site_description}</p>}
                        {socials.length > 0 && (
                            <ul className="mt-5 flex flex-wrap gap-2" aria-label="Sosyal medya">
                                {socials.map(({ label, href, icon: Icon }) => (
                                    <li key={label}>
                                        <a
                                            href={href.trim()}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={label}
                                            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-brand-600 hover:text-white"
                                        >
                                            <Icon className="h-[18px] w-[18px]" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <FooterColumn id="footer-cats" title="Kategoriler" className="lg:col-span-2">
                        <FooterLink href="/products/">Tüm ürünler</FooterLink>
                        {categories.map(c => (
                            <FooterLink key={c.id} href={c.href}>
                                {c.name}
                            </FooterLink>
                        ))}
                    </FooterColumn>

                    <FooterColumn id="footer-help" title="Müşteri hizmetleri" className="lg:col-span-3">
                        {SUPPORT_LINKS.map(l => (
                            <FooterLink key={l.href} href={l.href}>
                                {l.label}
                            </FooterLink>
                        ))}
                        <FooterLink href="/profile/">Hesabım</FooterLink>
                    </FooterColumn>

                    {hasContact && (
                        <FooterColumn id="footer-contact" title="İletişim" className="lg:col-span-3" defaultOpen>
                            {s.footer_phone && (
                                <li>
                                    <a href={telHref(s.footer_phone)} className="inline-flex min-h-11 items-center gap-2.5 py-1 text-white/85 transition-colors hover:text-white lg:min-h-0">
                                        <Phone className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" />
                                        <span className="tabular-nums">{s.footer_phone}</span>
                                    </a>
                                </li>
                            )}
                            {whatsapp && (
                                <li>
                                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2.5 py-1 text-white/85 transition-colors hover:text-white lg:min-h-0">
                                        <MessageCircle className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" />
                                        WhatsApp ile yazın
                                    </a>
                                </li>
                            )}
                            {s.footer_email && (
                                <li>
                                    <a href={`mailto:${s.footer_email}`} className="inline-flex min-h-11 items-center gap-2.5 break-all py-1 text-white/85 transition-colors hover:text-white lg:min-h-0">
                                        <Mail className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" />
                                        {s.footer_email}
                                    </a>
                                </li>
                            )}
                            {s.footer_address && (
                                <li className="flex gap-2.5 py-1 text-white/65">
                                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" />
                                    <address className="not-italic leading-6">{s.footer_address}</address>
                                </li>
                            )}
                        </FooterColumn>
                    )}
                </div>
                {bottomBar}
            </div>
        </footer>
    )
}

/** Link column: a plain list on desktop, an accordion on phones (content stays in the HTML). */
function FooterColumn({
    id,
    title,
    className,
    defaultOpen = false,
    children,
}: {
    id: string
    title: string
    className?: string
    defaultOpen?: boolean
    children: React.ReactNode
}) {
    const [open, setOpen] = React.useState(defaultOpen)
    return (
        <div className={cn('border-t border-white/10 lg:border-0', className)}>
            <h2 className="text-sm font-semibold text-white">
                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${id}-list`}
                    onClick={() => setOpen(o => !o)}
                    className="flex min-h-[52px] w-full items-center justify-between text-left lg:hidden"
                >
                    {title}
                    <ChevronDown className={cn('h-5 w-5 text-white/60 transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
                </button>
                <span className="hidden lg:mb-4 lg:block">{title}</span>
            </h2>
            <ul id={`${id}-list`} className={cn('flex-col gap-1 pb-4 text-sm lg:flex lg:gap-2.5 lg:pb-0', open ? 'flex' : 'hidden')}>
                {children}
            </ul>
        </div>
    )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <li>
            <Link href={href} prefetch={false} className="inline-flex min-h-11 items-center text-white/75 transition-colors hover:text-white lg:min-h-0">
                {children}
            </Link>
        </li>
    )
}
