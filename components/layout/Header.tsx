"use client"

/**
 * Store header (spec §7). Rendered once by the root shell (LayoutProvider passes `fromShell`); legacy
 * pages that still render <Header /> themselves get nothing, so it never appears twice.
 *
 *   TopBar (static)        announcement bar
 *   <header> (sticky)      mobile:  [☰] [logo] ……… [👤] [🛍]   56px
 *                                   [🔍 search field]             52px  ┐ second row: slides under the first
 *                          desktop: [logo] [🔍 search ……] [👤 Hesabım] [♡] [🛍 Sepetim]   72px      │ row on scroll-down,
 *                                   DesktopNav: mega menu, admin links/menus, type links  48px  ┘ back on scroll-up
 *
 * The hide-on-scroll and the scrolled shadow are applied to the DOM directly from a passive,
 * rAF-throttled scroll listener (no React re-render while scrolling, transforms only: no layout shift).
 * Collapsed, the sticky header is 56px on phones and 72px on desktop.
 * /odeme gets a reduced checkout header (logo, "Güvenli ödeme", "Alışverişe dön"), spec §13.
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronLeft, Heart, Lock, Menu, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatTL } from "@/lib/format"
import { originalImageUrl } from "@/lib/images"
import { hasSessionHint } from "@/lib/session-hint"
import { itemsTotal } from "@/lib/pricing"
import { useCartStore } from "@/store/cart-store"
import { useShellChrome, useSiteSettings } from "@/components/layout/store-data"
import { useShellUI } from "@/components/layout/shell-ui"
import { SearchCombobox } from "@/components/search/SearchCombobox"
import { DesktopNav } from "./MegaMenu"
import { TopBar } from "./TopBar"

const COLLAPSE_MOBILE = 52 // height of the mobile search row
const COLLAPSE_DESKTOP = 48 // height of the desktop nav row

export function Header({ fromShell = false, variant = 'store' }: { fromShell?: boolean; variant?: 'store' | 'checkout' }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return variant === 'checkout' ? <CheckoutHeader /> : <StoreHeader />
}

function StoreHeader() {
    const headerRef = React.useRef<HTMLElement>(null)
    const row1Ref = React.useRef<HTMLDivElement>(null)
    const revealRef = React.useRef<() => void>(() => { })
    const searchOpen = useShellUI(s => s.searchOpen)
    const menuOpen = useShellUI(s => s.menuOpen)
    const openMenu = useShellUI(s => s.openMenu)

    React.useEffect(() => {
        const header = headerRef.current
        const row1 = row1Ref.current
        if (!header || !row1) return
        const desktop = window.matchMedia('(min-width: 1024px)')
        let lastY = window.scrollY
        let collapsed = false
        let ticking = false

        const setCollapsed = (next: boolean) => {
            if (next === collapsed) return
            collapsed = next
            const by = desktop.matches ? COLLAPSE_DESKTOP : COLLAPSE_MOBILE
            header.dataset.collapsed = next ? 'true' : 'false'
            header.style.transform = next ? `translateY(-${by}px)` : ''
            row1.style.transform = next ? `translateY(${by}px)` : ''
        }
        // Un-hide at once (no slide) before a search opens: the mobile sheet is position:fixed inside
        // the header, so the header must not carry a transform, not even mid-transition.
        revealRef.current = () => {
            if (!collapsed) return
            header.style.transition = 'none'
            row1.style.transition = 'none'
            setCollapsed(false)
            void header.offsetHeight
            header.style.transition = ''
            row1.style.transition = ''
        }

        const update = () => {
            ticking = false
            const y = Math.max(0, window.scrollY)
            header.dataset.scrolled = y > 4 ? 'true' : 'false'
            const typing = header.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT'
            // keep it open while a menu or the search is in use, and near the top of the page
            const menuOpen = !!header.querySelector('nav [aria-expanded="true"]')
            if (useShellUI.getState().searchOpen || typing || menuOpen || y < 160) {
                setCollapsed(false)
                lastY = y
                return
            }
            const dy = y - lastY
            if (dy > 6) {
                setCollapsed(true)
                lastY = y
            } else if (dy < -6) {
                setCollapsed(false)
                lastY = y
            }
        }
        const onScroll = () => {
            if (!ticking) {
                ticking = true
                requestAnimationFrame(update)
            }
        }
        const onBreakpoint = () => {
            setCollapsed(false)
            update()
        }
        // Keyboard focus must never land on the hidden second row
        const onFocusIn = () => revealRef.current()
        update()
        window.addEventListener('scroll', onScroll, { passive: true })
        desktop.addEventListener('change', onBreakpoint)
        header.addEventListener('focusin', onFocusIn)
        return () => {
            window.removeEventListener('scroll', onScroll)
            desktop.removeEventListener('change', onBreakpoint)
            header.removeEventListener('focusin', onFocusIn)
            revealRef.current = () => { }
        }
    }, [])

    const reveal = React.useCallback(() => revealRef.current(), [])

    return (
        <>
            <TopBar />
            <header
                ref={headerRef}
                data-site-header=""
                className={cn(
                    'group/header sticky top-0 bg-white transition-[transform,box-shadow] duration-200 ease-out data-[scrolled=true]:shadow-raised',
                    // The mobile search sheet lives inside the header: lift it above every overlay while open
                    searchOpen ? 'z-drawer' : 'z-header',
                )}
            >
                <div
                    ref={row1Ref}
                    className={cn(
                        'relative z-[1] bg-white transition-transform duration-200 ease-out',
                        'lg:border-b lg:border-line group-data-[collapsed=true]/header:border-transparent',
                    )}
                >
                    <div className="container-store flex h-14 items-center gap-1 lg:h-[72px] lg:gap-8">
                        <button
                            type="button"
                            onClick={openMenu}
                            aria-label="Menüyü aç"
                            aria-haspopup="dialog"
                            aria-expanded={menuOpen}
                            aria-controls="mobile-menu"
                            className="-ml-2.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-card text-ink transition-colors hover:bg-surface-2 lg:hidden"
                        >
                            <Menu className="h-6 w-6" aria-hidden="true" strokeWidth={1.75} />
                        </button>
                        <Logo className="mr-auto lg:mr-0" />
                        <div className="hidden min-w-0 flex-1 justify-center lg:flex">
                            <SearchCombobox variant="desktop" onBeforeOpen={reveal} className="max-w-[640px]" />
                        </div>
                        <div className="-mr-2.5 flex shrink-0 items-center lg:mr-0 lg:gap-1">
                            <AccountLink />
                            <FavoritesLink />
                            <CartButton />
                        </div>
                    </div>
                </div>
                <div className="border-b border-line bg-white lg:hidden">
                    <div className="container-store h-[52px] pb-2">
                        <SearchCombobox variant="mobile" onBeforeOpen={reveal} />
                    </div>
                </div>
                <DesktopNav />
            </header>
        </>
    )
}

function CheckoutHeader() {
    return (
        <header className="sticky top-0 z-header border-b border-line bg-white">
            <div className="container-store flex h-14 items-center gap-2 lg:h-[72px]">
                <Link
                    href="/products/"
                    prefetch={false}
                    aria-label="Alışverişe dön"
                    className="-ml-2.5 inline-flex h-11 w-11 items-center justify-center rounded-card text-ink hover:bg-surface-2 sm:hidden"
                >
                    <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                </Link>
                <Logo className="mr-auto" />
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                    <Lock className="h-4 w-4" aria-hidden="true" strokeWidth={2.25} />
                    Güvenli ödeme
                    <span className="hidden font-medium text-muted md:inline">· 256-bit SSL</span>
                </span>
                <Link
                    href="/products/"
                    prefetch={false}
                    className="ml-4 hidden h-11 items-center gap-1 rounded-card px-3 text-sm font-semibold text-ink-2 hover:bg-surface-2 hover:text-ink sm:inline-flex"
                >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Alışverişe dön
                </Link>
            </div>
        </header>
    )
}

/** Logo from Admin › Ayarlar (logo_url, 5:1), site name as text if it is missing or fails to load. */
function Logo({ className }: { className?: string }) {
    const settings = useSiteSettings()
    const siteName = settings.site_name || 'Onopo'
    const src = settings.logo_url ? originalImageUrl(settings.logo_url) : null
    const [failed, setFailed] = React.useState(false)
    const imgRef = React.useRef<HTMLImageElement>(null)
    React.useEffect(() => {
        const img = imgRef.current
        if (img && img.complete && img.naturalWidth === 0) setFailed(true)
    }, [])

    return (
        <Link
            href="/"
            prefetch={false}
            aria-label={`${siteName} ana sayfa`}
            className={cn('flex shrink-0 items-center rounded-thumb', className)}
        >
            {src && !failed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    ref={imgRef}
                    src={src}
                    alt={`${siteName} Store`}
                    width={1080}
                    height={216}
                    decoding="async"
                    onError={() => setFailed(true)}
                    className="h-7 w-auto lg:h-8"
                />
            ) : (
                <span className="text-[22px] font-extrabold leading-none tracking-tight text-ink lg:text-2xl">
                    {siteName.toLocaleLowerCase('tr-TR')}
                    <span className="text-brand-500">store</span>
                </span>
            )}
        </Link>
    )
}

const ICON_BTN =
    'relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-card px-2.5 text-ink transition-colors duration-150 hover:bg-surface-2'

/**
 * "Giriş yap" (/login/) in the server HTML, which the edge cache shares between all anonymous visitors.
 * After hydration, and again after each navigation (logout is a client navigation), the readable session
 * hint (lib/session-hint) switches it to "Hesabım" (/profile/). Decided in an effect, so the server and
 * the first client render match. The label box always reserves the width of the longer label (the
 * other one sits in an invisible ::after), so the swap never moves the header.
 */
function AccountLink() {
    const pathname = usePathname()
    const [signedIn, setSignedIn] = React.useState(false)
    React.useEffect(() => {
        setSignedIn(hasSessionHint())
    }, [pathname])
    const label = signedIn ? 'Hesabım' : 'Giriş yap'
    return (
        <Link href={signedIn ? '/profile/' : '/login/'} prefetch={false} aria-label={label} className={ICON_BTN}>
            <User className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
            <span
                data-alt={signedIn ? 'Giriş yap' : 'Hesabım'}
                className="hidden text-sm font-semibold after:invisible after:col-start-1 after:row-start-1 after:h-0 after:content-[attr(data-alt)] xl:inline-grid"
            >
                <span className="col-start-1 row-start-1">{label}</span>
            </span>
        </Link>
    )
}

function FavoritesLink() {
    return (
        <Link href="/profile/?tab=favorites" prefetch={false} aria-label="Favorilerim" className={cn(ICON_BTN, 'hidden lg:inline-flex')}>
            <Heart className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
        </Link>
    )
}

function CartButton() {
    const items = useCartStore(s => s.items)
    const isOpen = useCartStore(s => s.isOpen)
    const openCart = useCartStore(s => s.openCart)
    const count = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    const total = itemsTotal(items)
    const bump = useBump(count)
    const label = count > 0 ? `Sepetim, ${count} ürün, ${formatTL(total)}` : 'Sepetim, boş'

    return (
        <button
            type="button"
            onClick={openCart}
            aria-label={label}
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            aria-controls="cart-drawer"
            className={cn(ICON_BTN, 'lg:pr-3 xl:gap-3')}
        >
            <span className="relative">
                <ShoppingBag className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
                {count > 0 && (
                    <span
                        key={bump}
                        aria-hidden="true"
                        className={cn(
                            'absolute -right-2 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white tabular-nums',
                            bump > 0 && 'animate-badge-bump',
                        )}
                    >
                        {count > 99 ? '99+' : count}
                    </span>
                )}
            </span>
            <span className="hidden min-w-[76px] flex-col items-start text-left leading-tight xl:flex" aria-hidden="true">
                <span className="text-[11px] font-medium text-muted">Sepetim</span>
                <span className="text-sm font-bold tabular-nums text-ink">{count > 0 ? formatTL(total) : '0,00 ₺'}</span>
            </span>
        </button>
    )
}

/**
 * Increments when the cart count goes up through a user action (not when the saved cart is loaded
 * after the page loads), so the badge can replay its bump animation.
 */
function useBump(count: number): number {
    const [bump, setBump] = React.useState(0)
    const prev = React.useRef<number | null>(null)
    React.useEffect(() => {
        const persist = useCartStore.persist
        const baseline = () => {
            prev.current = useCartStore.getState().items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
        }
        if (persist.hasHydrated()) baseline()
        return persist.onFinishHydration(baseline)
    }, [])
    React.useEffect(() => {
        if (prev.current === null) return
        if (count > prev.current) setBump(b => b + 1)
        prev.current = count
    }, [count])
    return bump
}
