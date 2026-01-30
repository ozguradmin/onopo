"use client"

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { CartDrawer } from "@/components/cart/CartDrawer"
import { MobileNav } from "@/components/layout/MobileNav"

export function LayoutProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const isAdmin = pathname.startsWith('/admin')
    const isMaintenancePage = pathname === '/maintenance'
    const isLoginPage = pathname === '/login' || pathname === '/register'

    // CRITICAL: Use mounted state to prevent hydration mismatch
    const [mounted, setMounted] = React.useState(false)
    const [maintenanceMode, setMaintenanceMode] = React.useState(false)
    const [checked, setChecked] = React.useState(false)

    // Set mounted on client only
    React.useEffect(() => {
        setMounted(true)
    }, [])

    React.useEffect(() => {
        if (!mounted) return

        // Skip maintenance check for admin, login, and maintenance pages
        if (isAdmin || isMaintenancePage || isLoginPage) {
            setChecked(true)
            return
        }

        // Check maintenance mode from site settings
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(settings => {
                const isInMaintenance = settings.maintenance_mode === 'true' || settings.maintenance_mode === true
                setMaintenanceMode(isInMaintenance)
                setChecked(true)

                if (isInMaintenance && !isAdmin && !isMaintenancePage) {
                    router.push('/maintenance')
                }
            })
            .catch(() => {
                setChecked(true) // Allow access if settings fetch fails
            })
    }, [mounted, pathname, isAdmin, isMaintenancePage, isLoginPage, router])

    // Always render the same structure on first server render to prevent hydration issues
    // During SSR and initial client render, show a minimal loading state
    if (!mounted) {
        return (
            <div className="min-h-screen bg-slate-50">
                {children}
            </div>
        )
    }

    // Show loading while checking maintenance status (only after mounted)
    if (!checked && !isAdmin && !isMaintenancePage) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="animate-spin w-8 h-8 border-4 border-slate-300 border-t-slate-900 rounded-full"></div>
            </div>
        )
    }

    if (isAdmin) {
        // Admin pages - no header/footer/nav
        return <>{children}</>
    }

    // Maintenance page - no header/footer
    if (isMaintenancePage) {
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
