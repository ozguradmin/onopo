"use client"

import * as React from "react"
import { ShoppingBag, User, Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, getImageUrl } from "@/lib/utils"
import Link from 'next/link'
import { useRouter } from "next/navigation"
import { useCartStore } from "@/store/cart-store"
import { useCategories, useMenus, useShellChrome, useSiteSettings } from "@/components/layout/store-data"

import { TopBar } from "./TopBar"

/** Internal links navigate client-side; absolute/external ones stay plain anchors. */
function NavLink({ href, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
    if (/^(https?:|mailto:|tel:|#)/i.test(href)) return <a href={href} {...rest} />
    return <Link href={href} prefetch={false} {...rest} />
}

/**
 * Store header. Rendered once by the root shell (LayoutProvider passes `fromShell`); legacy pages that
 * still render <Header /> themselves get nothing, so the header never appears twice.
 * Data (logo, site name, menus, categories) comes from the server via the store-data context.
 */
export function Header({ fromShell = false }: { fromShell?: boolean }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return <HeaderInner />
}

function HeaderInner() {
    const [isScrolled, setIsScrolled] = React.useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [searchOpen, setSearchOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState("")
    const router = useRouter()
    const settings = useSiteSettings()
    const logoUrl = settings.logo_url ? getImageUrl(settings.logo_url) : ""
    const siteName = settings.site_name || "ONOPO"
    const customMenus = useMenus()
    const headerRef = React.useRef<HTMLElement>(null)
    const [menuTop, setMenuTop] = React.useState<number | null>(null)

    // Search navigates only on submit, client-side (never while typing)
    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (searchQuery.trim()) {
            setIsMobileMenuOpen(false)
            router.push(`/products/?q=${encodeURIComponent(searchQuery.trim())}`)
        }
    }

    const { totalItems, toggleCart } = useCartStore()
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    const cartItemCount = mounted ? totalItems() : 0

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    // Open the mobile menu panel right under the sticky header, wherever it currently is
    React.useEffect(() => {
        if (!isMobileMenuOpen) return
        setMenuTop(headerRef.current ? Math.max(0, headerRef.current.getBoundingClientRect().bottom) : null)
    }, [isMobileMenuOpen])

    const cartLabel = cartItemCount > 0 ? `Sepet, ${cartItemCount} ürün` : "Sepet"

    return (
        <>
            <TopBar />
            {/* Sticky header in normal flow: content starts below it, no padding hack needed */}
            <header
                ref={headerRef}
                className={cn(
                    "sticky top-0 z-50 bg-white transition-shadow duration-300 flex flex-col",
                    isScrolled ? "shadow-lg" : "shadow-sm border-b border-slate-100"
                )}
            >
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Logo - Dynamic from settings */}
                        <Link
                            href="/"
                            className="flex items-center"
                            aria-label={`${siteName} ana sayfa`}
                        >
                            {logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={logoUrl} alt={siteName} width={200} height={40} fetchPriority="high" className="h-8 md:h-10 w-auto object-contain" />
                            ) : (
                                <span className="font-heading font-black text-2xl md:text-3xl tracking-tight text-slate-900 hover:text-primary transition-colors">
                                    {siteName}
                                </span>
                            )}
                        </Link>


                        {/* Desktop Navigation - Center */}
                        <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2" aria-label="Ana menü">
                            <NavLink href="/" className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                Anasayfa
                            </NavLink>

                            {/* Static Categories Dropdown */}
                            <div className="relative group">
                                <button className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all" aria-haspopup="true">
                                    Kategoriler
                                    <svg className="w-4 h-4 transition-transform group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                                    <CategoriesDropdown />
                                </div>
                            </div>

                            <NavLink href="/products/" className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                Tüm Ürünler
                            </NavLink>

                            {/* Dynamic Menus */}
                            {customMenus.filter(m => !m.parent_id).map(menu => {
                                const children = customMenus.filter(c => c.parent_id === menu.id)

                                if (children.length > 0) {
                                    return (
                                        <div key={menu.id} className="relative group">
                                            <button className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all" aria-haspopup="true">
                                                {menu.title}
                                                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                                                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </button>
                                            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                                                {children.map(child => (
                                                    <NavLink
                                                        key={child.id}
                                                        href={child.url}
                                                        className="block px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                                                    >
                                                        {child.title}
                                                    </NavLink>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }

                                return (
                                    <NavLink
                                        key={menu.id}
                                        href={menu.url}
                                        className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                                    >
                                        {menu.title}
                                    </NavLink>
                                )
                            })}
                        </nav>

                        {/* Desktop Actions - Right */}
                        <div className="hidden lg:flex items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                {searchOpen ? (
                                    <form onSubmit={handleSearch} role="search" className="flex items-center rounded-full px-4 h-10 w-64 bg-slate-100 border border-slate-200">
                                        <Search className="w-4 h-4 mr-2 text-slate-500" aria-hidden="true" />
                                        <input
                                            type="search"
                                            enterKeyHint="search"
                                            autoComplete="off"
                                            aria-label="Ürün ara"
                                            placeholder="Ürün ara..."
                                            autoFocus
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent border-none outline-none text-sm w-full text-slate-900 placeholder-slate-400"
                                        />
                                        <button type="button" aria-label="Aramayı kapat" onClick={() => {
                                            const currentPath = window.location.pathname
                                            if (currentPath.includes('/products') && window.location.search.includes('q=')) {
                                                // On the products page with a search: drop the q param (client-side)
                                                const params = new URLSearchParams(window.location.search)
                                                params.delete('q')
                                                setSearchQuery("")
                                                router.push(`/products/${params.toString() ? '?' + params.toString() : ''}`)
                                            } else {
                                                // Just close the search bar
                                                setSearchOpen(false)
                                                setSearchQuery("")
                                            }
                                        }} className="ml-2">
                                            <X className="w-4 h-4 text-slate-500 hover:text-slate-900" />
                                        </button>
                                    </form>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Ürün ara"
                                        onClick={() => setSearchOpen(true)}
                                        className="rounded-full w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    >
                                        <Search className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>

                            {/* User */}
                            <Link href="/profile" aria-label="Hesabım" className="inline-flex items-center justify-center rounded-full w-10 h-10 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 hover:bg-slate-100 hover:text-slate-900 text-slate-600">
                                <User className="w-5 h-5" />
                            </Link>

                            {/* Cart */}
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={cartLabel}
                                onClick={mounted ? toggleCart : undefined}
                                className="rounded-full w-10 h-10 relative bg-slate-900 text-white hover:bg-slate-800"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {mounted && cartItemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                                        {cartItemCount}
                                    </span>
                                )}
                            </Button>
                        </div>

                        {/* Mobile: Cart + Menu */}
                        <div className="flex lg:hidden items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={cartLabel}
                                onClick={mounted ? toggleCart : undefined}
                                className="rounded-full w-10 h-10 relative bg-slate-900 text-white"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {mounted && cartItemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                                        {cartItemCount}
                                    </span>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={isMobileMenuOpen ? "Menüyü kapat" : "Menüyü aç"}
                                aria-expanded={isMobileMenuOpen}
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="rounded-full w-10 h-10 text-slate-900"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header >

            {/* Mobile Menu */}
            {
                isMobileMenuOpen && (
                    <div className="fixed inset-0 z-40 lg:hidden">
                        <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
                        <div
                            className="absolute top-16 md:top-20 left-0 right-0 bg-white shadow-xl p-6 h-[80vh] overflow-y-auto"
                            style={menuTop != null ? { top: menuTop } : undefined}
                        >
                            <nav className="flex flex-col gap-2" aria-label="Mobil menü">
                                <NavLink
                                    href="/"
                                    className="flex items-center justify-between px-4 py-4 rounded-xl text-lg font-semibold text-slate-800 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Anasayfa
                                    <span className="text-slate-400">→</span>
                                </NavLink>

                                <MobileCategoriesDropdown onClose={() => setIsMobileMenuOpen(false)} />

                                <NavLink
                                    href="/products/"
                                    className="flex items-center justify-between px-4 py-4 rounded-xl text-lg font-semibold text-slate-800 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    Tüm Ürünler
                                    <span className="text-slate-400">→</span>
                                </NavLink>

                                {/* Dynamic Menus Mobile */}
                                {customMenus.filter(m => !m.parent_id).map(menu => {
                                    const children = customMenus.filter(c => c.parent_id === menu.id)
                                    return (
                                        <div key={menu.id}>
                                            <NavLink
                                                href={menu.url}
                                                className="flex items-center justify-between px-4 py-4 rounded-xl text-lg font-semibold text-slate-800 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                            >
                                                {menu.title}
                                                <span className="text-slate-400">→</span>
                                            </NavLink>
                                            {children.map(child => (
                                                <NavLink
                                                    key={child.id}
                                                    href={child.url}
                                                    className="flex items-center justify-between px-4 py-3 ml-4 rounded-xl text-base font-medium text-slate-600 hover:bg-slate-50 transition-all"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                >
                                                    {child.title}
                                                    <span className="text-slate-400">→</span>
                                                </NavLink>
                                            ))}
                                        </div>
                                    )
                                })}
                            </nav>
                            <div className="mt-6 pt-6 border-t border-slate-100">
                                <form onSubmit={handleSearch} role="search" className="flex items-center gap-2 mb-4">
                                    <input
                                        type="search"
                                        enterKeyHint="search"
                                        autoComplete="off"
                                        aria-label="Ürün ara"
                                        placeholder="Ürün ara..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex-1 h-12 px-4 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                    />
                                    <Button type="submit" aria-label="Ara" className="h-12 px-6 rounded-xl bg-slate-900 text-white">
                                        <Search className="w-4 h-4" />
                                    </Button>
                                </form>
                                <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                                    <div className="inline-flex items-center justify-center rounded-xl text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-95 border border-slate-200 bg-transparent hover:bg-slate-100 hover:text-slate-900 w-full h-12 text-slate-700">
                                        <User className="w-4 h-4 mr-2" /> Hesabım
                                    </div>
                                </Link>
                            </div>
                        </div>
                    </div>
                )
            }
        </>
    )
}

function CategoriesDropdown() {
    // Categories (with counts that match the listings) come from the server layout
    const categories = useCategories()

    if (categories.length === 0) return <div className="px-4 py-2 text-xs text-slate-400">Kategori bulunamadı</div>

    return (
        <div className="max-h-[300px] overflow-y-auto">
            {categories.map(cat => (
                <Link
                    key={cat.id}
                    href={cat.href}
                    prefetch={false}
                    className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <span>{cat.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{cat.product_count}</span>
                </Link>
            ))}
        </div>
    )
}

function MobileCategoriesDropdown({ onClose }: { onClose: () => void }) {
    const [isOpen, setIsOpen] = React.useState(true)
    const categories = useCategories()

    return (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between px-4 py-4 text-lg font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-all"
            >
                <span>Kategoriler</span>
                <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {isOpen && (
                <div className="bg-white border-t border-slate-100">
                    {categories.length === 0 ? (
                        <div className="px-6 py-3 text-sm text-slate-400">Kategori bulunamadı</div>
                    ) : (
                        categories.map(cat => (
                            <Link
                                key={cat.id}
                                href={cat.href}
                                prefetch={false}
                                onClick={onClose}
                                className="flex items-center justify-between px-6 py-3 text-base font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                            >
                                <span>{cat.name}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cat.product_count}</span>
                            </Link>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
