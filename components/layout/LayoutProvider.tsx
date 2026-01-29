"use client"

import { usePathname } from 'next/navigation'
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { MobileNav } from "@/components/layout/MobileNav"

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isAdmin = pathname.startsWith('/admin')

    if (isAdmin) {
        // Admin pages - no header/footer/nav
        return <>{children}</>
    }

    return (
        <>
            <Header />
            <CartDrawer />
            <main className="min-h-screen pt-16">
                {children}
            </main>
            <Footer />
            <MobileNav />
        </>
    )
}
