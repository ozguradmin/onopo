"use client"

/**
 * Mobile bottom navigation (<768), spec §7: Ana sayfa · Kategoriler · Ara · Sepet · Hesabım.
 * Rendered once by the root shell (`fromShell`) and present in the server HTML, so its space is
 * reserved from the first paint (body has pb-16 on mobile). Only the cart badge fills in after mount.
 * - "Kategoriler" goes to /kategoriler/, "Ara" opens the full-screen search sheet, "Sepet" the cart drawer.
 * - Not rendered on /odeme, /siparis-basarili and /siparis-hata (LayoutProvider, and by pathname here).
 *   Slid away while a drawer, the search sheet or the assistant's phone sheet is open. display: none
 *   (so out of the tab order and the accessibility tree) on pages that render an element with
 *   `data-hide-bottom-nav` (e.g. the product page's sticky buy bar), see app/globals.css.
 * - No login check on load: "Hesabım" always goes to /profile/ (which sends guests to the login).
 * - "Ana sayfa" and "Kategoriler" are prefetched as soon as the bar is on screen (PrefetchLink "view"; not the tab of
 *   the page you are on), so switching tabs shows the page at once; "Hesabım" (personal) is never prefetched.
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/store/cart-store"
import { useShellChrome } from "@/components/layout/store-data"
import { openMobileSearch, useShellUI } from "@/components/layout/shell-ui"
import { PrefetchLink } from "@/components/layout/PrefetchLink"
import { useAssistantStore } from "@/components/assistant/assistant-store"

export function MobileNav({ fromShell = false }: { fromShell?: boolean }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return <MobileNavInner />
}

const NO_BOTTOM_NAV_PATHS = ['/odeme', '/siparis-basarili', '/siparis-hata']

const ITEM = 'relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-none transition-colors'

function MobileNavInner() {
    const pathname = usePathname()
    const path = (pathname || '/').replace(/\/+$/, '') || '/'
    const items = useCartStore(s => s.items)
    const cartOpen = useCartStore(s => s.isOpen)
    const openCart = useCartStore(s => s.openCart)
    const menuOpen = useShellUI(s => s.menuOpen)
    const searchOpen = useShellUI(s => s.searchOpen)
    // The assistant's phone sheet (< 768 px; the panel sets isSheet) covers the page like a drawer
    const assistantSheetOpen = useAssistantStore(s => s.open && !s.minimized && s.isSheet)
    const count = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    const overlayOpen = cartOpen || menuOpen || searchOpen || assistantSheetOpen

    // Never on checkout and PayTR's result pages (not in the DOM at all, so not focusable or tappable)
    if (NO_BOTTOM_NAV_PATHS.includes(path)) return null

    const tone = (active: boolean) => (active ? 'text-brand-600' : 'text-muted hover:text-ink')

    return (
        <>
            <nav
                aria-label="Alt menü"
                data-bottom-nav=""
                className={cn(
                    'fixed inset-x-0 bottom-0 z-bottom-nav border-t border-line bg-white pb-safe transition-transform duration-250 ease-sheet md:hidden',
                    overlayOpen && 'translate-y-full',
                )}
            >
                <ul className="mx-auto flex max-w-[560px] items-stretch">
                    <li className="flex flex-1">
                        <PrefetchLink href="/" prefetchOn={path === '/' ? 'none' : 'view'} aria-current={path === '/' ? 'page' : undefined} className={cn(ITEM, tone(path === '/'))}>
                            <Home className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={path === '/' ? 2.25 : 1.75} />
                            Ana sayfa
                        </PrefetchLink>
                    </li>
                    <li className="flex flex-1">
                        {/* The categories page (owner: the tab opened the side menu, which already has its own button) */}
                        <PrefetchLink href="/kategoriler/" prefetchOn={path === '/kategoriler' ? 'none' : 'view'} aria-current={path === '/kategoriler' ? 'page' : undefined} className={cn(ITEM, tone(path === '/kategoriler'))}>
                            <LayoutGrid className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={path === '/kategoriler' ? 2.25 : 1.75} />
                            Kategoriler
                        </PrefetchLink>
                    </li>
                    <li className="flex flex-1">
                        <button
                            type="button"
                            onClick={() => {
                                if (!openMobileSearch()) window.scrollTo({ top: 0 })
                            }}
                            aria-haspopup="dialog"
                            aria-expanded={searchOpen}
                            className={cn(ITEM, tone(searchOpen))}
                        >
                            <Search className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
                            Ara
                        </button>
                    </li>
                    <li className="flex flex-1">
                        <button
                            type="button"
                            onClick={openCart}
                            aria-haspopup="dialog"
                            aria-expanded={cartOpen}
                            aria-controls="cart-drawer"
                            aria-label={count > 0 ? `Sepet, ${count} ürün` : 'Sepet, boş'}
                            className={cn(ITEM, tone(cartOpen))}
                        >
                            <span className="relative">
                                <ShoppingBag className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
                                {count > 0 && (
                                    <span
                                        aria-hidden="true"
                                        className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white tabular-nums"
                                    >
                                        {count > 99 ? '99+' : count}
                                    </span>
                                )}
                            </span>
                            <span aria-hidden="true">Sepet</span>
                        </button>
                    </li>
                    <li className="flex flex-1">
                        <Link
                            href="/profile/"
                            prefetch={false}
                            aria-current={path === '/profile' ? 'page' : undefined}
                            className={cn(ITEM, tone(path === '/profile' || path === '/login' || path === '/register' || path === '/orders'))}
                        >
                            <User className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
                            Hesabım
                        </Link>
                    </li>
                </ul>
            </nav>
            {/* Extra room for the iPhone home indicator (the body already reserves 64px) */}
            <div aria-hidden="true" className="h-[env(safe-area-inset-bottom,0px)] md:hidden" data-bottom-nav="" />
        </>
    )
}
