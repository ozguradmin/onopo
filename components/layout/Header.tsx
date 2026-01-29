"use client"

import * as React from "react"
import { ShoppingBag, User, Search, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useCartStore } from "@/store/cart-store"

import { TopBar } from "./TopBar"

export function Header() {
    const [isScrolled, setIsScrolled] = React.useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
    const [searchOpen, setSearchOpen] = React.useState(false)
    const [searchQuery, setSearchQuery] = React.useState("")
    const [logoUrl, setLogoUrl] = React.useState("")
    const [siteName, setSiteName] = React.useState("ONOPO")

    const handleSearch = (e?: React.FormEvent) => {
        e?.preventDefault()
        if (searchQuery.trim()) {
            window.location.href = `/products?q=${encodeURIComponent(searchQuery.trim())}`
        }
    }

    const { totalItems, toggleCart } = useCartStore()
    const [mounted, setMounted] = React.useState(false)

    const [navLinks, setNavLinks] = React.useState([
        { href: "/", label: "Anasayfa" },
        { href: "/tech", label: "Teknoloji" },
        { href: "/beauty", label: "Kozmetik" },
        { href: "/gaming", label: "Oyun" },
    ])

    const [customMenus, setCustomMenus] = React.useState<any[]>([])

    React.useEffect(() => {
        setMounted(true)
        // Fetch site settings
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => {
                if (data.logo_url) setLogoUrl(data.logo_url)
                if (data.site_name) setSiteName(data.site_name)
            }).catch(() => { })

        // Fetch Menus
        fetch('/api/menus')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setCustomMenus(data)
            }).catch(() => { })
    }, [])

    const cartItemCount = mounted ? totalItems() : 0

    React.useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }
        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    return (
        <>
            {/* ALWAYS WHITE HEADER - Works on every page */}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50 bg-white transition-shadow duration-300 flex flex-col",
                    isScrolled ? "shadow-lg" : "shadow-sm border-b border-slate-100"
                )}
            >
                <TopBar />
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between h-16 md:h-20">
                        {/* Logo - Dynamic from settings */}
                        <a
                            href="/"
                            className="flex items-center"
                        >
                            {logoUrl ? (
                                <img src={logoUrl} alt={siteName} className="h-8 md:h-10 object-contain" />
                            ) : (
                                <span className="font-heading font-black text-2xl md:text-3xl tracking-tight text-slate-900 hover:text-primary transition-colors">
                                    {siteName}
                                </span>
                            )}
                        </a>

                        {/* Desktop Navigation - Center */}
                        <nav className="hidden lg:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
                            <a href="/" className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                Anasayfa
                            </a>

                            {/* Static Categories Dropdown */}
                            <div className="relative group">
                                <button className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                    Kategoriler
                                    <svg className="w-4 h-4 transition-transform group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </button>
                                <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                                    <CategoriesDropdown />
                                </div>
                            </div>

                            {/* Dynamic Menus */}
                            {customMenus.filter(m => !m.parent_id).map(menu => {
                                const children = customMenus.filter(c => c.parent_id === menu.id)
                                if (children.length > 0) {
                                    return (
                                        <div key={menu.id} className="relative group">
                                            <button className="flex items-center gap-1 px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all">
                                                {menu.title}
                                                <svg className="w-4 h-4 transition-transform group-hover:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </button>
                                            <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all transform translate-y-2 group-hover:translate-y-0 z-50">
                                                {children.map(child => (
                                                    <a
                                                        key={child.id}
                                                        href={child.url}
                                                        className="block px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
                                                    >
                                                        {child.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                }
                                return (
                                    <a
                                        key={menu.id}
                                        href={menu.url}
                                        className="px-4 py-2 rounded-full text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
                                    >
                                        {menu.title}
                                    </a>
                                )
                            })}
                        </nav>

                        {/* Desktop Actions - Right */}
                        <div className="hidden lg:flex items-center gap-2">
                            {/* Search */}
                            <div className="relative">
                                {searchOpen ? (
                                    <form onSubmit={handleSearch} className="flex items-center rounded-full px-4 h-10 w-64 bg-slate-100 border border-slate-200">
                                        <Search className="w-4 h-4 mr-2 text-slate-500" />
                                        <input
                                            type="text"
                                            placeholder="Ürün ara..."
                                            autoFocus
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="bg-transparent border-none outline-none text-sm w-full text-slate-900 placeholder-slate-400"
                                        />
                                        <button type="button" onClick={() => {
                                            setSearchOpen(false);
                                            setSearchQuery("");
                                            // Clear URL param if exists
                                            const url = new URL(window.location.href);
                                            if (url.searchParams.has('q')) {
                                                url.searchParams.delete('q');
                                                window.location.href = url.toString();
                                            }
                                        }} className="ml-2">
                                            <X className="w-4 h-4 text-slate-500 hover:text-slate-900" />
                                        </button>
                                    </form>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setSearchOpen(true)}
                                        className="rounded-full w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                    >
                                        <Search className="w-5 h-5" />
                                    </Button>
                                )}
                            </div>

                            {/* User */}
                            <a href="/profile">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-full w-10 h-10 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                >
                                    <User className="w-5 h-5" />
                                </Button>
                            </a>

                            {/* Cart */}
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={toggleCart}
                                className="rounded-full w-10 h-10 relative bg-slate-900 text-white hover:bg-slate-800"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {cartItemCount > 0 && (
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
                                onClick={toggleCart}
                                className="rounded-full w-10 h-10 relative bg-slate-900 text-white"
                            >
                                <ShoppingBag className="w-5 h-5" />
                                {cartItemCount > 0 && (
                                    <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold border-2 border-white">
                                        {cartItemCount}
                                    </span>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="rounded-full w-10 h-10 text-slate-900"
                            >
                                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setIsMobileMenuOpen(false)} />
                    <div className="absolute top-16 md:top-20 left-0 right-0 bg-white shadow-xl p-6">
                        <nav className="flex flex-col gap-2">
                            {navLinks.map((link) => {
                                if (link.label === 'Kategoriler') {
                                    return <MobileCategoriesDropdown key={link.href} onClose={() => setIsMobileMenuOpen(false)} />
                                }
                                return (
                                    <a
                                        key={link.href}
                                        href={link.href}
                                        className="flex items-center justify-between px-4 py-4 rounded-xl text-lg font-semibold text-slate-800 hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                                        onClick={() => setIsMobileMenuOpen(false)}
                                    >
                                        {link.label}
                                        <span className="text-slate-400">→</span>
                                    </a>
                                )
                            })}
                        </nav>
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <form onSubmit={handleSearch} className="flex items-center gap-2 mb-4">
                                <input
                                    type="text"
                                    placeholder="Ürün ara..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="flex-1 h-12 px-4 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
                                />
                                <Button type="submit" className="h-12 px-6 rounded-xl bg-slate-900 text-white">
                                    <Search className="w-4 h-4" />
                                </Button>
                            </form>
                            <a href="/login">
                                <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-slate-700">
                                    <User className="w-4 h-4 mr-2" /> Hesabım
                                </Button>
                            </a>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function CategoriesDropdown() {
    const [categories, setCategories] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        // Find distinct categories with product count
        fetch('/api/products')
            .then(res => res.json())
            .then(products => {
                if (Array.isArray(products)) {
                    const cats = products.reduce((acc: any, product: any) => {
                        if (!product.category) return acc
                        if (!acc[product.category]) acc[product.category] = 0
                        acc[product.category]++
                        return acc
                    }, {})
                    setCategories(Object.entries(cats).map(([name, count]) => ({ name, count })))
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div className="px-4 py-2 text-xs text-slate-400">Yükleniyor...</div>
    if (categories.length === 0) return <div className="px-4 py-2 text-xs text-slate-400">Kategori bulunamadı</div>

    return (
        <div className="max-h-[300px] overflow-y-auto">
            {categories.map((cat: any) => (
                <a
                    key={cat.name}
                    href={`/products?category=${encodeURIComponent(cat.name)}`}
                    className="flex items-center justify-between px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                >
                    <span className="capitalize">{cat.name}</span>
                    <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{cat.count}</span>
                </a>
            ))}
        </div>
    )
}

function MobileCategoriesDropdown({ onClose }: { onClose: () => void }) {
    const [isOpen, setIsOpen] = React.useState(false)
    const [categories, setCategories] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/products')
            .then(res => res.json())
            .then(products => {
                if (Array.isArray(products)) {
                    const cats = products.reduce((acc: any, product: any) => {
                        if (!product.category) return acc
                        if (!acc[product.category]) acc[product.category] = 0
                        acc[product.category]++
                        return acc
                    }, {})
                    setCategories(Object.entries(cats).map(([name, count]) => ({ name, count })))
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    return (
        <div className="border border-slate-100 rounded-xl overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between px-4 py-4 text-lg font-semibold text-slate-800 bg-slate-50 hover:bg-slate-100 transition-all"
            >
                <span>Kategoriler</span>
                <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                    <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </button>
            {isOpen && (
                <div className="bg-white border-t border-slate-100">
                    {loading ? (
                        <div className="px-6 py-3 text-sm text-slate-400">Yükleniyor...</div>
                    ) : categories.length === 0 ? (
                        <div className="px-6 py-3 text-sm text-slate-400">Kategori bulunamadı</div>
                    ) : (
                        categories.map((cat: any) => (
                            <a
                                key={cat.name}
                                href={`/products?category=${encodeURIComponent(cat.name)}`}
                                onClick={onClose}
                                className="flex items-center justify-between px-6 py-3 text-base font-medium text-slate-600 hover:bg-slate-50 border-b border-slate-50 last:border-b-0"
                            >
                                <span className="capitalize">{cat.name}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cat.count}</span>
                            </a>
                        ))
                    )}
                </div>
            )}
        </div>
    )
}
