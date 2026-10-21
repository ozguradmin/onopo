"use client"

/**
 * Desktop navigation row (≥1024, static under the sticky header), spec §7.
 *
 * - Items: Admin › Header links (site_settings.header_links) in admin order; the link whose href is
 *   "#categories" becomes the "Kategoriler" mega-menu trigger (added first when the admin list has
 *   none). Then the top-level Admin › Menüler items; items with children open a dropdown.
 *   Without admin links: [Kategoriler] [Tüm ürünler] + product-type quick links.
 * - Mega menu: categories with counts (Admin › Kategoriler, hideEmpty), "Ürün tipine göre" and
 *   "Cihazına göre" quick links (or the admin menu columns when menus with children exist), and a
 *   promo card built from the real shipping/installment data.
 * - Disclosure-button pattern: click, or hover with a 150 ms intent delay; Escape closes and returns
 *   focus to the trigger; closes on outside click and on navigation. The panel follows its trigger in
 *   the DOM, so Tab walks into it naturally.
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    ArrowRight, BatteryCharging, Cable, Car, ChevronDown, ChevronRight, Headphones, LayoutGrid, ShieldCheck,
    Smartphone, Zap, type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { MenuItem } from "@/lib/catalog"
import { useShellFacts, useStoreData } from "@/components/layout/store-data"
import { CategoryIcon } from "./CategoryIcon"
import {
    buildMenuTree, CONNECTOR_LINKS, formatAmountShort, isExternalHref, normalizeHref, PRODUCT_TYPE_LINKS, samePath,
    type NavLinkItem,
} from "./nav-data"

const TYPE_ICONS: Record<string, LucideIcon> = {
    'sarj-aleti': Zap,
    kablo: Cable,
    arac: Car,
    powerbank: BatteryCharging,
    'ekran-koruyucu': ShieldCheck,
    kulaklik: Headphones,
}

/** Internal links navigate client-side (no prefetch); external ones are plain anchors. */
export function ShellLink({
    href,
    children,
    ...rest
}: Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { href: string }) {
    const target = normalizeHref(href)
    if (isExternalHref(target)) {
        const external = /^https?:/i.test(target)
        return (
            <a href={target} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
                {children}
            </a>
        )
    }
    return (
        <Link href={target} prefetch={false} {...rest}>
            {children}
        </Link>
    )
}

function useCurrentHref(): string {
    const pathname = usePathname() || '/'
    return pathname
}

function isActive(href: string, pathname: string): boolean {
    const target = normalizeHref(href)
    if (isExternalHref(target) || target.includes('?')) return false
    return samePath(target, pathname)
}

/** Hover intent: open after `openDelay` ms, close after `closeDelay` ms (mouse only). */
function useHoverIntent(setOpen: (open: boolean) => void, openDelay = 150, closeDelay = 200) {
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const clear = () => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
    }
    React.useEffect(() => clear, [])
    return {
        onPointerEnter: (e: React.PointerEvent) => {
            if (e.pointerType !== 'mouse') return
            clear()
            timer.current = setTimeout(() => setOpen(true), openDelay)
        },
        onPointerLeave: (e: React.PointerEvent) => {
            if (e.pointerType !== 'mouse') return
            clear()
            timer.current = setTimeout(() => setOpen(false), closeDelay)
        },
        cancel: clear,
    }
}

/** Shared open/close plumbing for the mega menu and the admin-menu dropdowns. */
function useDisclosure() {
    const [open, setOpen] = React.useState(false)
    const rootRef = React.useRef<HTMLLIElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
    const pathname = usePathname()

    React.useEffect(() => {
        setOpen(false)
    }, [pathname])

    React.useEffect(() => {
        if (!open) return
        const onDown = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setOpen(false)
                triggerRef.current?.focus()
            }
        }
        const onFocusOut = (e: FocusEvent) => {
            const next = e.relatedTarget as Node | null
            if (next && rootRef.current && !rootRef.current.contains(next)) setOpen(false)
        }
        document.addEventListener('mousedown', onDown)
        document.addEventListener('keydown', onKey)
        const root = rootRef.current
        root?.addEventListener('focusout', onFocusOut)
        return () => {
            document.removeEventListener('mousedown', onDown)
            document.removeEventListener('keydown', onKey)
            root?.removeEventListener('focusout', onFocusOut)
        }
    }, [open])

    const hover = useHoverIntent(setOpen)
    return { open, setOpen, rootRef, triggerRef, hover }
}

const ITEM =
    'relative inline-flex h-12 items-center gap-1.5 px-3 text-sm font-semibold text-ink-2 transition-colors duration-150 hover:text-ink ' +
    'after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-brand-600 after:opacity-0 after:transition-opacity hover:after:opacity-100'

export function DesktopNav() {
    const { settings, menus } = useStoreData()
    const pathname = useCurrentHref()
    const tree = React.useMemo(() => buildMenuTree(menus), [menus])

    const links: NavLinkItem[] = React.useMemo(() => {
        const admin = settings.header_links.filter(l => l.label && l.href)
        if (admin.length === 0) return [{ label: 'Kategoriler', href: '#categories' }, { label: 'Tüm ürünler', href: '/products/' }]
        return admin.some(l => l.href === '#categories') ? admin : [{ label: 'Kategoriler', href: '#categories' }, ...admin]
    }, [settings.header_links])

    return (
        <nav aria-label="Ana menü" className="relative hidden border-b border-line bg-white lg:block">
            <div className="container-store flex h-12 items-center">
                <ul className="-ml-3 flex min-w-0 items-center">
                    {links.map((l, i) =>
                        l.href === '#categories' ? (
                            <MegaMenuItem key={`mega-${i}`} label={l.label} hasMenus={tree.some(m => m.children.length > 0)} tree={tree} />
                        ) : (
                            <li key={`${l.href}-${i}`}>
                                <ShellLink
                                    href={l.href}
                                    aria-current={isActive(l.href, pathname) ? 'page' : undefined}
                                    className={cn(ITEM, 'aria-[current=page]:text-ink aria-[current=page]:after:opacity-100')}
                                >
                                    {l.label}
                                </ShellLink>
                            </li>
                        ),
                    )}
                    {tree.map(m =>
                        m.children.length > 0 ? (
                            <MenuDropdown key={m.id} item={m} />
                        ) : (
                            <li key={m.id}>
                                <ShellLink
                                    href={m.url}
                                    aria-current={isActive(m.url, pathname) ? 'page' : undefined}
                                    className={cn(ITEM, 'aria-[current=page]:text-ink aria-[current=page]:after:opacity-100')}
                                >
                                    {m.title}
                                </ShellLink>
                            </li>
                        ),
                    )}
                </ul>
                <ul className="ml-auto hidden shrink-0 items-center gap-1 xl:flex" aria-label="Ürün tipleri">
                    {PRODUCT_TYPE_LINKS.slice(0, 5).map(t => {
                        const Icon = TYPE_ICONS[t.key] ?? Zap
                        return (
                            <li key={t.key}>
                                <Link
                                    href={t.href}
                                    prefetch={false}
                                    rel="nofollow"
                                    className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
                                >
                                    <Icon className="h-4 w-4 text-brand-500" aria-hidden="true" strokeWidth={1.75} />
                                    {t.short}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </nav>
    )
}

function MegaMenuItem({ label, hasMenus, tree }: { label: string; hasMenus: boolean; tree: MenuItem[] }) {
    const { open, setOpen, rootRef, triggerRef, hover } = useDisclosure()
    const panelId = 'mega-menu-panel'
    return (
        <li ref={rootRef} onPointerEnter={hover.onPointerEnter} onPointerLeave={hover.onPointerLeave}>
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => {
                    hover.cancel()
                    setOpen(!open)
                }}
                className={cn(ITEM, 'text-ink', open && 'after:opacity-100')}
            >
                <LayoutGrid className="h-[18px] w-[18px] text-brand-600" aria-hidden="true" strokeWidth={2} />
                {label}
                <ChevronDown className={cn('h-4 w-4 text-muted transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
            </button>
            <div id={panelId} hidden={!open} className="pointer-events-none absolute inset-x-0 top-full z-overlay">
                <div className="container-store">
                    <div className="pointer-events-auto rounded-b-sheet border border-t-0 border-line bg-white shadow-overlay">
                        <MegaPanel hasMenus={hasMenus} tree={tree} onNavigate={() => setOpen(false)} />
                    </div>
                </div>
            </div>
        </li>
    )
}

function MegaPanel({ hasMenus, tree, onNavigate }: { hasMenus: boolean; tree: MenuItem[]; onNavigate: () => void }) {
    const { categories, shipping, maxInstallments } = useStoreData()
    const { returnDays } = useShellFacts()
    const columns = hasMenus ? tree.filter(m => m.children.length > 0).slice(0, 2) : []
    const totalCount = categories.reduce((n, c) => n + c.product_count, 0)

    return (
        <div className="grid grid-cols-12 gap-8 p-6 xl:p-8">
            <div className="col-span-4">
                <p className="type-micro mb-2 text-muted">Kategoriler</p>
                <ul className="flex flex-col gap-0.5">
                    {categories.map(c => (
                        <li key={c.id}>
                            <Link
                                href={c.href}
                                prefetch={false}
                                onClick={onNavigate}
                                className="group flex items-center gap-3 rounded-card px-2 py-2 transition-colors hover:bg-surface"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                    <CategoryIcon name={c.icon} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
                                    <span className="block text-[13px] text-muted">{c.product_count} ürün</span>
                                </span>
                                <ChevronRight className="h-4 w-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                            </Link>
                        </li>
                    ))}
                </ul>
                <Link
                    href="/products/"
                    prefetch={false}
                    onClick={onNavigate}
                    className="mt-3 inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-brand-600 hover:text-brand-700"
                >
                    Tüm ürünleri gör{totalCount > 0 ? ` (${totalCount})` : ''}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
            </div>

            {columns.length > 0 ? (
                columns.map((col, i) => (
                    <div key={col.id} className={cn(i === 0 ? (columns.length === 1 ? 'col-span-5' : 'col-span-3') : 'col-span-2')}>
                        <p className="type-micro mb-3 text-muted">{col.title}</p>
                        <ul className="flex flex-col">
                            {col.children.map(child => (
                                <li key={child.id}>
                                    <ShellLink
                                        href={child.url}
                                        onClick={onNavigate}
                                        className="flex min-h-10 items-center text-[15px] font-medium text-ink-2 transition-colors hover:text-brand-600"
                                    >
                                        {child.title}
                                    </ShellLink>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            ) : (
                <>
                    <div className="col-span-3">
                        <p className="type-micro mb-3 text-muted">Ürün tipine göre</p>
                        <ul className="flex flex-col">
                            {PRODUCT_TYPE_LINKS.map(t => {
                                const Icon = TYPE_ICONS[t.key] ?? Zap
                                return (
                                    <li key={t.key}>
                                        <Link
                                            href={t.href}
                                            prefetch={false}
                                            rel="nofollow"
                                            onClick={onNavigate}
                                            className="flex min-h-10 items-center gap-2.5 text-[15px] font-medium text-ink-2 transition-colors hover:text-brand-600"
                                        >
                                            <Icon className="h-[18px] w-[18px] text-brand-500" aria-hidden="true" strokeWidth={1.75} />
                                            {t.label}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>
                    <div className="col-span-2">
                        <p className="type-micro mb-3 text-muted">Cihazına göre</p>
                        <ul className="flex flex-col">
                            {CONNECTOR_LINKS.map(t => (
                                <li key={t.key}>
                                    <Link
                                        href={t.href}
                                        prefetch={false}
                                        rel="nofollow"
                                        onClick={onNavigate}
                                        className="flex min-h-10 items-center gap-2.5 text-[15px] font-medium text-ink-2 transition-colors hover:text-brand-600"
                                    >
                                        {t.key === 'iphone' || t.key === 'type-c' || t.key === 'micro-usb' ? (
                                            <Smartphone className="h-[18px] w-[18px] text-brand-500" aria-hidden="true" strokeWidth={1.75} />
                                        ) : t.key === '20w' ? (
                                            <Zap className="h-[18px] w-[18px] text-brand-500" aria-hidden="true" strokeWidth={1.75} />
                                        ) : (
                                            <Cable className="h-[18px] w-[18px] text-brand-500" aria-hidden="true" strokeWidth={1.75} />
                                        )}
                                        {t.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>
                </>
            )}

            <div className="col-span-3">
                <div className="relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-sheet bg-ink p-6 text-white">
                    <div aria-hidden="true" className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-600/40 blur-2xl" />
                    <div className="relative">
                        <p className="type-micro text-brand-100">Onopo avantajları</p>
                        <p className="mt-2 text-xl font-bold leading-7">
                            {shipping.freeShippingThreshold > 0
                                ? `${formatAmountShort(shipping.freeShippingThreshold)} üzeri kargo bedava`
                                : 'Hızlı ve güvenli alışveriş'}
                        </p>
                        <ul className="mt-3 flex flex-col gap-1 text-sm text-white/80">
                            {maxInstallments && <li>Kredi kartına {maxInstallments} taksit</li>}
                            <li>{returnDays} gün kolay iade</li>
                            <li>PayTR ile güvenli ödeme</li>
                        </ul>
                    </div>
                    <Link
                        href="/products/"
                        prefetch={false}
                        onClick={onNavigate}
                        className="relative mt-5 inline-flex h-11 items-center justify-center gap-2 self-start rounded-card bg-white px-4 text-sm font-semibold text-ink transition-colors hover:bg-surface"
                    >
                        Alışverişe başla
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </div>
            </div>
        </div>
    )
}

function MenuDropdown({ item }: { item: MenuItem }) {
    const { open, setOpen, rootRef, triggerRef, hover } = useDisclosure()
    const id = `menu-dd-${item.id}`
    return (
        <li ref={rootRef} className="relative" onPointerEnter={hover.onPointerEnter} onPointerLeave={hover.onPointerLeave}>
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-controls={id}
                onClick={() => {
                    hover.cancel()
                    setOpen(!open)
                }}
                className={cn(ITEM, open && 'text-ink after:opacity-100')}
            >
                {item.title}
                <ChevronDown className={cn('h-4 w-4 text-muted transition-transform duration-200', open && 'rotate-180')} aria-hidden="true" />
            </button>
            <div id={id} hidden={!open} className="absolute left-0 top-full z-overlay min-w-56 rounded-b-sheet border border-line bg-white p-2 shadow-overlay">
                <ul>
                    {item.url && item.url !== '#' && (
                        <li>
                            <ShellLink
                                href={item.url}
                                onClick={() => setOpen(false)}
                                className="flex min-h-10 items-center rounded-thumb px-3 text-sm font-semibold text-ink hover:bg-surface"
                            >
                                Tümü
                            </ShellLink>
                        </li>
                    )}
                    {item.children.map(child => (
                        <li key={child.id}>
                            <ShellLink
                                href={child.url}
                                onClick={() => setOpen(false)}
                                className="flex min-h-10 items-center rounded-thumb px-3 text-sm font-medium text-ink-2 hover:bg-surface hover:text-ink"
                            >
                                {child.title}
                            </ShellLink>
                        </li>
                    ))}
                </ul>
            </div>
        </li>
    )
}
