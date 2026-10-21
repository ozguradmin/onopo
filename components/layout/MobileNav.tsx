"use client"

/**
 * Mobile bottom navigation (<768), spec §7: Ana sayfa · Kategoriler · Ara · Sepet · Hesabım.
 * Rendered once by the root shell (`fromShell`) and present in the server HTML, so its space is
 * reserved from the first paint (body has pb-16 on mobile). Only the cart badge fills in after mount.
 * - "Kategoriler" opens the menu drawer, "Ara" the full-screen search sheet, "Sepet" the cart drawer.
 * - Hidden on /odeme (LayoutProvider), while a drawer or the search sheet is open, and on pages that
 *   render an element with `data-hide-bottom-nav` (e.g. the product page's sticky buy bar), see
 *   app/globals.css.
 * - No login check on load: "Hesabım" always goes to /profile/ (which sends guests to the login).
 */
import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutGrid, Search, ShoppingBag, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/store/cart-store"
import { useShellChrome } from "@/components/layout/store-data"
import { openMobileSearch, useShellUI } from "@/components/layout/shell-ui"

export function MobileNav({ fromShell = false }: { fromShell?: boolean }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return <MobileNavInner />
}

const ITEM = 'relative flex h-16 min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-semibold leading-none transition-colors'

function MobileNavInner() {
    const pathname = usePathname()
    const path = (pathname || '/').replace(/\/+$/, '') || '/'
    const items = useCartStore(s => s.items)
    const cartOpen = useCartStore(s => s.isOpen)
    const openCart = useCartStore(s => s.openCart)
    const menuOpen = useShellUI(s => s.menuOpen)
    const searchOpen = useShellUI(s => s.searchOpen)
    const openMenu = useShellUI(s => s.openMenu)
    const count = items.reduce((n, i) => n + (Number(i.quantity) || 0), 0)
    const overlayOpen = cartOpen || menuOpen || searchOpen

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
                        <Link href="/" prefetch={false} aria-current={path === '/' ? 'page' : undefined} className={cn(ITEM, tone(path === '/'))}>
                            <Home className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={path === '/' ? 2.25 : 1.75} />
                            Ana sayfa
                        </Link>
                    </li>
                    <li className="flex flex-1">
                        <button
                            type="button"
                            onClick={openMenu}
                            aria-haspopup="dialog"
                            aria-expanded={menuOpen}
                            aria-controls="mobile-menu"
                            className={cn(ITEM, tone(menuOpen))}
                        >
                            <LayoutGrid className="h-[22px] w-[22px]" aria-hidden="true" strokeWidth={1.75} />
                            Kategoriler
                        </button>
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
