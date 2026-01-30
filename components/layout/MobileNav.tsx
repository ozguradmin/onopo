"use client"

import * as React from "react"
import { Home, Search, ShoppingBag, User } from "lucide-react"
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function MobileNav() {
    const pathname = usePathname()
    const { totalItems, toggleCart } = useCartStore()
    const [mounted, setMounted] = React.useState(false)
    const [isLoggedIn, setIsLoggedIn] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
        // Check if user is logged in
        fetch('/api/auth/me')
            .then(res => {
                if (res.ok) {
                    return res.json()
                }
                throw new Error('Not logged in')
            })
            .then(data => {
                if (data?.user?.id) {
                    setIsLoggedIn(true)
                }
            })
            .catch(() => {
                setIsLoggedIn(false)
            })
    }, [])

    const cartItemCount = mounted ? totalItems() : 0

    // Prevent hydration mismatch
    if (!mounted) return null

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/80 backdrop-blur-lg border-t border-border h-16 px-6 flex items-center justify-between">
            <NavItem href="/" icon={<Home className="w-6 h-6" />} label="Anasayfa" active={pathname === "/"} />
            <NavItem href="/products" icon={<Search className="w-6 h-6" />} label="Ara" />

            <button
                onClick={toggleCart}
                className="flex flex-col items-center justify-center space-y-1 text-muted-foreground w-12 relative"
            >
                <div className="relative">
                    <ShoppingBag className="w-6 h-6" />
                    {cartItemCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white font-bold">
                            {cartItemCount}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-medium">Sepet</span>
            </button>

            <NavItem
                href={isLoggedIn ? "/profile" : "/login"}
                icon={<User className="w-6 h-6" />}
                label={isLoggedIn ? "Profilim" : "Giriş"}
                active={pathname === "/profile" || pathname === "/login"}
            />
        </div>
    )
}

function NavItem({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <Link
            href={href}
            className={cn(
                "flex flex-col items-center justify-center space-y-1 w-12 transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            <span className="text-[10px] font-medium">{label}</span>
        </Link>
    )
}

