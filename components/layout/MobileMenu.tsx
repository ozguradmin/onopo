"use client"

/**
 * Mobile menu drawer (<1024), spec §7: left drawer, 86vw (max 360), focus trap, Escape, scroll lock.
 *   1. account row ("Giriş yap / Üye ol" or "Merhaba, {ad}"); /api/auth/me is asked only when the
 *      drawer opens, never on page load
 *   2. categories with icon and count (Admin › Kategoriler), all categories, all products, then
 *      "Cihaza göre" (/cihaz/) and "Rehberler" (/rehber/)
 *   3. "Ürün tipine göre" and "Cihazına göre" quick links (or the admin menus when they exist)
 *   4. Admin › Header links
 *   5. help pages, contact (phone, WhatsApp, e-mail)
 * Opened by the header ☰ button and the bottom-nav "Kategoriler" button. Page links are prefetched on touch, hover
 * or focus (PrefetchLink); the account links never are.
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, ChevronRight, Mail, MessageCircle, Phone, Smartphone, User, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonClasses } from "@/components/ui/button"
import { useStoreData } from "@/components/layout/store-data"
import { useShellUI } from "@/components/layout/shell-ui"
import { Drawer } from "./Drawer"
import { CategoryIcon } from "./CategoryIcon"
import { ShellLink, useActiveNavHref } from "./MegaMenu"
import { PrefetchLink } from "./PrefetchLink"
import { buildMenuTree, CONNECTOR_LINKS, normalizeHref, PRODUCT_TYPE_LINKS, SUPPORT_LINKS, telHref, whatsappHref } from "./nav-data"

type AuthState = { status: 'unknown' } | { status: 'out' } | { status: 'in'; name: string }

/** Asks /api/auth/me once per opening of the drawer (the cookie is HttpOnly). */
function useAuthOnOpen(open: boolean): AuthState {
    const [auth, setAuth] = React.useState<AuthState>({ status: 'unknown' })
    React.useEffect(() => {
        if (!open) return
        let cancelled = false
        fetch('/api/auth/me/', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
            .then(res => (res.ok ? res.json() : null))
            .then(data => {
                if (cancelled) return
                const user = data?.user
                if (user?.id) {
                    const first = String(user.full_name || '').trim().split(/\s+/)[0] || ''
                    setAuth({ status: 'in', name: first })
                } else {
                    setAuth({ status: 'out' })
                }
            })
            .catch(() => {
                if (!cancelled) setAuth({ status: 'out' })
            })
        return () => {
            cancelled = true
        }
    }, [open])
    return auth
}

// The device pages and the shopping guides (lib/devices DEVICES_PATH, lib/guides GUIDES_PATH; literals here so
// the menu chunk does not pull those modules in)
const BROWSE_LINKS = [
    { href: '/cihaz/', label: 'Cihaza göre', Icon: Smartphone },
    { href: '/rehber/', label: 'Rehberler', Icon: BookOpen },
] as const

// aria-current rows (the page you are on) get the brand tint
const ROW = 'flex min-h-[52px] items-center gap-3 px-4 text-[15px] font-medium text-ink transition-colors active:bg-surface hover:bg-surface aria-[current=page]:bg-brand-50 aria-[current=page]:text-brand-700'

export function MobileMenu() {
    const open = useShellUI(s => s.menuOpen)
    const closeMenu = useShellUI(s => s.closeMenu)
    const { categories, settings, menus } = useStoreData()
    const pathname = usePathname()
    const auth = useAuthOnOpen(open)
    const closeRef = React.useRef<HTMLButtonElement>(null)
    const tree = React.useMemo(() => buildMenuTree(menus), [menus])
    // Admin header links, minus what the drawer already has (home, the categories, all products, devices, guides)
    const extraLinks = settings.header_links.filter(l => {
        const href = normalizeHref(l.href)
        return l.href !== '#categories' && href !== '/' && href !== '/products/' && !BROWSE_LINKS.some(b => b.href === href)
    })
    const whatsapp = whatsappHref(settings.whatsapp_number)
    // "You are here" across the drawer's links, query-aware (Yeni Gelenler vs Tüm ürünler)
    const active = useActiveNavHref([
        ...categories.map(c => c.href),
        '/products/',
        ...BROWSE_LINKS.map(l => l.href),
        ...tree.flatMap(m => [m.url, ...m.children.map(ch => ch.url)]),
        ...extraLinks.map(l => l.href),
        ...SUPPORT_LINKS.map(l => l.href),
    ])
    const current = (href: string | null | undefined) => (active !== null && !!href && normalizeHref(href) === active ? 'page' as const : undefined)

    // Close on navigation, not on mount: the menu loads lazily (LayoutProvider), and a tap on the menu button
    // before it has loaded mounts it already open
    const shownPath = React.useRef(pathname)
    React.useEffect(() => {
        if (shownPath.current === pathname) return
        shownPath.current = pathname
        closeMenu()
    }, [pathname, closeMenu])

    return (
        <Drawer open={open} onClose={closeMenu} side="left" labelledBy="mobile-menu-title" initialFocus={closeRef} className="w-[86vw] max-w-[360px]">
            <div id="mobile-menu" className="flex h-full flex-col">
                <div className="flex h-14 shrink-0 items-center justify-between border-b border-line pl-4 pr-2">
                    <h2 id="mobile-menu-title" className="text-base font-bold text-ink">
                        Menü
                    </h2>
                    <button
                        ref={closeRef}
                        type="button"
                        onClick={closeMenu}
                        aria-label="Menüyü kapat"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-card text-ink hover:bg-surface-2"
                    >
                        <X className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain pb-[max(24px,env(safe-area-inset-bottom))]">
                    {/* 1. account */}
                    <div className="border-b border-line px-4 py-4">
                        {auth.status === 'in' ? (
                            <Link href="/profile/" prefetch={false} onClick={closeMenu} className="flex items-center gap-3">
                                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                    <User className="h-5 w-5" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold text-ink">Merhaba{auth.name ? `, ${auth.name}` : ''}</span>
                                    <span className="block text-[13px] text-muted">Hesabım ve siparişlerim</span>
                                </span>
                                <ChevronRight className="h-5 w-5 text-subtle" aria-hidden="true" />
                            </Link>
                        ) : (
                            <div className={cn('grid grid-cols-2 gap-2', auth.status === 'unknown' && 'opacity-90')}>
                                <Link href="/login/" prefetch={false} onClick={closeMenu} className={buttonClasses({ variant: 'brand', size: '44' })}>
                                    Giriş yap
                                </Link>
                                <Link href="/register/" prefetch={false} onClick={closeMenu} className={buttonClasses({ variant: 'outline-ink', size: '44' })}>
                                    Üye ol
                                </Link>
                            </div>
                        )}
                    </div>

                    {/* 2. categories */}
                    <section aria-labelledby="mm-cats" className="border-b border-line py-2">
                        <h3 id="mm-cats" className="type-micro px-4 pb-1 pt-2 text-muted">
                            Kategoriler
                        </h3>
                        <ul>
                            {categories.map(c => (
                                <li key={c.id}>
                                    <PrefetchLink href={c.href} onClick={closeMenu} aria-current={current(c.href)} className={ROW}>
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                            <CategoryIcon name={c.icon} className="h-[18px] w-[18px]" />
                                        </span>
                                        <span className="line-clamp-2 min-w-0 flex-1 py-1.5 font-semibold leading-5">{c.name}</span>
                                        <span className="text-[13px] tabular-nums text-muted">{c.product_count}</span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                                    </PrefetchLink>
                                </li>
                            ))}
                            <li>
                                <PrefetchLink href="/kategoriler/" onClick={closeMenu} aria-current={current('/kategoriler/')} className={cn(ROW, 'font-semibold text-brand-600')}>
                                    <span className="flex-1">Tüm kategorileri gör</span>
                                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                                </PrefetchLink>
                            </li>
                            <li>
                                <PrefetchLink href="/products/" onClick={closeMenu} aria-current={current('/products/')} className={cn(ROW, 'font-semibold text-brand-600')}>
                                    <span className="flex-1">Tüm ürünler</span>
                                    <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                                </PrefetchLink>
                            </li>
                            {BROWSE_LINKS.map(({ href, label, Icon }) => (
                                <li key={href}>
                                    <PrefetchLink href={href} onClick={closeMenu} aria-current={current(href)} className={ROW}>
                                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                            <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                                        </span>
                                        <span className="min-w-0 flex-1 py-1.5 font-semibold leading-5">{label}</span>
                                        <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                                    </PrefetchLink>
                                </li>
                            ))}
                        </ul>
                    </section>

                    {/* 3. admin menus or product types */}
                    {tree.length > 0 ? (
                        <section aria-label="Menü" className="border-b border-line py-2">
                            <ul>
                                {tree.map(m => (
                                    <li key={m.id}>
                                        {!m.url || m.url.trim() === '#' ? (
                                            <p className="type-micro px-4 pb-1 pt-3 text-muted">{m.title}</p>
                                        ) : (
                                            <ShellLink href={m.url} onClick={closeMenu} aria-current={current(m.url)} className={cn(ROW, 'font-semibold')}>
                                                <span className="flex-1">{m.title}</span>
                                                <ChevronRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                                            </ShellLink>
                                        )}
                                        {m.children.length > 0 && (
                                            <ul className="pb-1">
                                                {m.children.map(ch => (
                                                    <li key={ch.id}>
                                                        <ShellLink href={ch.url} onClick={closeMenu} aria-current={current(ch.url)} className={cn(ROW, 'min-h-11 pl-8 text-ink-2')}>
                                                            {ch.title}
                                                        </ShellLink>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ) : (
                        <section aria-labelledby="mm-types" className="border-b border-line px-4 py-3">
                            <h3 id="mm-types" className="type-micro pb-2.5 pt-1 text-muted">
                                Ürün tipine göre
                            </h3>
                            <ul className="flex flex-wrap gap-2">
                                {PRODUCT_TYPE_LINKS.map(t => (
                                    <li key={t.key}>
                                        <Link
                                            href={t.href}
                                            prefetch={false}
                                            rel="nofollow"
                                            onClick={closeMenu}
                                            className="inline-flex h-10 items-center rounded-full border border-line px-3.5 text-sm font-medium text-ink-2 active:bg-surface"
                                        >
                                            {t.short}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <h3 className="type-micro pb-2.5 pt-4 text-muted">Cihazına göre</h3>
                            <ul className="flex flex-wrap gap-2">
                                {CONNECTOR_LINKS.map(t => (
                                    <li key={t.key}>
                                        <Link
                                            href={t.href}
                                            prefetch={false}
                                            rel="nofollow"
                                            onClick={closeMenu}
                                            className="inline-flex h-10 items-center rounded-full border border-line px-3.5 text-sm font-medium text-ink-2 active:bg-surface"
                                        >
                                            {t.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 4. admin header links */}
                    {extraLinks.length > 0 && (
                        <section aria-label="Keşfet" className="border-b border-line py-2">
                            <ul>
                                {extraLinks.map((l, i) => (
                                    <li key={`${l.href}-${i}`}>
                                        <ShellLink href={l.href} onClick={closeMenu} aria-current={current(l.href)} className={ROW}>
                                            <span className="flex-1">{l.label}</span>
                                            <ChevronRight className="h-4 w-4 text-subtle" aria-hidden="true" />
                                        </ShellLink>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {/* 5. help and contact */}
                    <section aria-labelledby="mm-help" className="py-2">
                        <h3 id="mm-help" className="type-micro px-4 pb-1 pt-2 text-muted">
                            Yardım
                        </h3>
                        <ul>
                            {SUPPORT_LINKS.map(l => (
                                <li key={l.href}>
                                    <PrefetchLink href={l.href} onClick={closeMenu} aria-current={current(l.href)} className={cn(ROW, 'min-h-11 text-ink-2')}>
                                        {l.label}
                                    </PrefetchLink>
                                </li>
                            ))}
                        </ul>
                        {(settings.footer_phone || whatsapp || settings.footer_email) && (
                            <div className="mx-4 mt-3 flex flex-col gap-2 rounded-card bg-surface p-3">
                                {settings.footer_phone && (
                                    <a href={telHref(settings.footer_phone)} className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-ink">
                                        <Phone className="h-5 w-5 text-brand-600" aria-hidden="true" />
                                        <span className="tabular-nums">{settings.footer_phone}</span>
                                    </a>
                                )}
                                {whatsapp && (
                                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 text-[15px] font-semibold text-whatsapp">
                                        <MessageCircle className="h-5 w-5" aria-hidden="true" />
                                        WhatsApp destek
                                    </a>
                                )}
                                {settings.footer_email && (
                                    <a href={`mailto:${settings.footer_email}`} className="flex min-h-11 items-center gap-3 break-all text-sm font-medium text-ink-2">
                                        <Mail className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                                        {settings.footer_email}
                                    </a>
                                )}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </Drawer>
    )
}
