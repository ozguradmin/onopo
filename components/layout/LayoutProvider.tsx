"use client"

/**
 * Store shell, rendered by the server root layout (app/layout.tsx) with data loaded on the server.
 *
 * - No mount gate, no spinner, no remount: the server HTML already contains the header, the page and
 *   the footer, and the element around the page never changes type, so pages mount exactly once.
 * - Chrome by path: /admin/* and /maintenance get no store header/footer (admin has its own layout).
 *   /odeme gets the reduced checkout header and footer and no bottom nav (spec §13).
 *   /siparis-basarili and /siparis-hata (PayTR's result pages, shown inside the payment iframe on
 *   /odeme) get no store chrome at all, so nothing in the frame opens the store inside the iframe.
 * - Maintenance mode comes from site_settings (server data, passed in `data`). When it is on, every
 *   path except /admin/*, /maintenance, /login and /register renders the maintenance message in the
 *   server HTML (API routes never pass through layouts, so they are unaffected). That HTML carries the
 *   edge-cache "do not store" marker and the maintenance marker, for which worker.ts answers 503 with
 *   Retry-After and X-Robots-Tag: noindex (crawlers must not index the maintenance text as the page).
 * - Cart: rehydrates the persisted zustand store once on mount (the store uses skipHydration), then
 *   seeds its shipping rule from the server data (the drawer and /odeme still re-read
 *   /api/shipping-settings, so the totals always equal what the order API charges). Afterwards it follows
 *   the saved cart, except on /odeme: other tabs' changes and back/forward cache restores (watchSavedCart).
 * - Analytics: one POST /api/analytics/track per store page view, also on client-side navigations
 *   ({ page: pathname }; the first one of a page load adds landing: true and document.referrer).
 * - Optional `returnDays` (CMS return window from getSiteSeo) feeds the trust badges; default 14.
 * - Onopo Asistan: the launcher (components/assistant/AssistantRoot) only while the public setting
 *   ai_assistant_enabled is on, and never on checkout. Off, nothing of it renders or loads.
 */
import * as React from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Wrench, Mail } from 'lucide-react'
import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"
import { useShellUI } from "@/components/layout/shell-ui"
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'
import { DEFAULT_SHELL_FACTS, ShellChromeContext, ShellFactsContext, StoreDataProvider } from '@/components/layout/store-data'
import { syncSavedCart, useCartStore, watchSavedCart } from "@/store/cart-store"
import type { PublicSiteSettings, StorefrontData } from '@/lib/catalog'

const MAINTENANCE_EXEMPT = ['/maintenance', '/login', '/register']

// Closed until used: the cart drawer, the mobile menu and the assistant load after the page has loaded, one
// per idle period (or at once when the cart or the menu is opened first). Bundled into the shell and
// hydrated with the page they made one long task on phones (Total Blocking Time); none of them is visible in
// the server HTML (the drawers render their content only after the first open).
const CartDrawer = dynamic(() => import('@/components/cart/CartDrawer').then(m => m.CartDrawer), { ssr: false })
const MobileMenu = dynamic(() => import('@/components/layout/MobileMenu').then(m => m.MobileMenu), { ssr: false })
const AssistantRoot = dynamic(() => import('@/components/assistant/AssistantRoot').then(m => m.AssistantRoot), { ssr: false })

/**
 * 0 until the page has loaded, then 1, 2, 3 in three separate idle periods (each at most ~3 s apart), so the
 * cart drawer, the menu and the assistant mount one at a time. The state changes are transitions: React
 * renders them in small slices instead of one long task.
 */
function useIdleStage(): number {
    const [stage, setStage] = React.useState(0)
    React.useEffect(() => {
        const w = window as Window & {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
            cancelIdleCallback?: (id: number) => void
        }
        let idleId: number | undefined
        let timer: ReturnType<typeof setTimeout> | undefined
        let next = 0
        const schedule = () => {
            const step = () => {
                next += 1
                React.startTransition(() => setStage(next))
                if (next < 3) schedule()
            }
            if (w.requestIdleCallback) idleId = w.requestIdleCallback(step, { timeout: 3000 })
            else timer = setTimeout(step, 500)
        }
        if (document.readyState === 'complete') schedule()
        else window.addEventListener('load', schedule, { once: true })
        // A tap before then (pointerdown comes ~100 ms before the click) starts loading both drawers' code
        const preload = () => {
            void import('@/components/cart/CartDrawer')
            void import('@/components/layout/MobileMenu')
        }
        window.addEventListener('pointerdown', preload, { once: true, passive: true })
        return () => {
            window.removeEventListener('load', schedule)
            window.removeEventListener('pointerdown', preload)
            if (idleId !== undefined) w.cancelIdleCallback?.(idleId)
            clearTimeout(timer)
        }
    }, [])
    return stage
}

/** The first tracked page view of this page load was sent (later ones are in-site navigations). */
let landingTracked = false

/** Tells the edge cache in worker.ts not to store this response (error and fallback renders). */
function NoEdgeCache() {
    return <div hidden data-onopo-nocache="" />
}

/** Tells worker.ts that this HTML is the maintenance render: it is sent as 503 (lib/edge-cache.ts). */
function MaintenanceMarker() {
    return <div hidden data-onopo-maintenance="" />
}

function normalizePath(pathname: string | null): string {
    if (!pathname) return '/'
    return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

export function LayoutProvider({
    data,
    returnDays,
    children,
}: {
    data: StorefrontData
    /** Return window in days from the CMS shipping page (getSiteSeo().returnPolicy?.days). */
    returnDays?: number | null
    children: React.ReactNode
}) {
    const path = normalizePath(usePathname())
    const isAdmin = path === '/admin' || path.startsWith('/admin/')
    const isMaintenancePage = path === '/maintenance'
    const isCheckout = path === '/odeme'
    const showMaintenance = data.settings.maintenance_mode && !isAdmin && !MAINTENANCE_EXEMPT.includes(path)
    const showChrome = !isAdmin && !isMaintenancePage && !showMaintenance
    // Store pages that render without header, drawers, footer and bottom nav (analytics still counts them)
    const isPaymentResult = path === '/siparis-basarili' || path === '/siparis-hata'
    const chrome = showChrome && !isPaymentResult
    // An empty category list means the layout data could not be loaded (the store always has
    // categories with products): never let the edge cache keep that render.
    const degraded = showChrome && data.categories.length === 0
    // Typed by the settings change of the assistant's API package; read defensively until then
    const assistantOn = (data.settings as PublicSiteSettings & { ai_assistant_enabled?: boolean }).ai_assistant_enabled === true

    const facts = React.useMemo(
        () => ({ returnDays: returnDays && returnDays > 0 && returnDays <= 365 ? Math.round(returnDays) : DEFAULT_SHELL_FACTS.returnDays }),
        [returnDays],
    )

    // The cart store is created with skipHydration: load the saved cart once in the browser, then use
    // the server's shipping rule until the drawer / checkout re-read /api/shipping-settings.
    const shipping = data.shipping
    React.useEffect(() => {
        Promise.resolve(useCartStore.persist.rehydrate()).finally(() => {
            if (shipping.freeShippingThreshold >= 0 && shipping.shippingCost >= 0) {
                useCartStore.setState({
                    shippingSettings: { freeThreshold: shipping.freeShippingThreshold, shippingCost: shipping.shippingCost },
                })
            }
        })
        // once per page load
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Then keep it in line with the saved cart (another tab adds or removes, Back restores this page). Not on
    // /odeme: it reads the cart once on mount, and while its payment frame is open, a cart emptied elsewhere
    // must not swap the frame for the empty-cart view (its own writes still start from the saved cart).
    React.useEffect(() => {
        if (isCheckout) return
        syncSavedCart() // changes made while this page was on /odeme
        return watchSavedCart()
    }, [isCheckout])

    // Page-view tracking (was in Footer on mount; now also counts client-side navigations)
    React.useEffect(() => {
        if (!showChrome) return
        try {
            // Only the first view of a page load carries the referrer (traffic sources, lib/analytics.ts)
            const landing = !landingTracked
            landingTracked = true
            fetch('/api/analytics/track', {
                method: 'POST',
                body: JSON.stringify(landing ? { page: window.location.pathname, landing: true, ref: document.referrer || '' } : { page: window.location.pathname }),
                keepalive: true,
            }).catch(() => { })
        } catch {
            // never let analytics break the page
        }
    }, [path, showChrome])

    const idleStage = useIdleStage()
    const cartOpen = useCartStore(s => s.isOpen)
    const menuOpen = useShellUI(s => s.menuOpen)

    const Main = isAdmin ? 'div' : 'main'
    const variant = isCheckout ? 'checkout' : 'store'

    return (
        <StoreDataProvider value={data}>
            <ShellFactsContext.Provider value={facts}>
                <ShellChromeContext.Provider value={showChrome}>
                    {degraded && <NoEdgeCache />}
                    {chrome && (
                        <a
                            href="#main-content"
                            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-card focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-overlay"
                        >
                            İçeriğe geç
                        </a>
                    )}
                    {chrome && <Header fromShell variant={variant} />}
                    {chrome && (idleStage >= 1 || cartOpen) && <CartDrawer />}
                    {chrome && !isCheckout && (idleStage >= 2 || menuOpen) && <MobileMenu />}
                    {/* The chrome-less result pages fill the frame in their own surface colour */}
                    <Main id="main-content" className={isPaymentResult ? 'min-h-dvh bg-surface' : showChrome ? 'min-h-[60vh]' : undefined}>
                        {showMaintenance ? (
                            <MaintenanceView settings={data.settings} />
                        ) : (
                            <GlobalErrorBoundary resetKey={path} variant="page">
                                {children}
                            </GlobalErrorBoundary>
                        )}
                    </Main>
                    {chrome && <Footer fromShell variant={variant} />}
                    {chrome && !isCheckout && <MobileNav fromShell />}
                    {chrome && !isCheckout && assistantOn && idleStage >= 3 && <AssistantRoot />}
                </ShellChromeContext.Provider>
            </ShellFactsContext.Provider>
        </StoreDataProvider>
    )
}

/** Server-rendered maintenance message (no client check, no spinner). Never stored by the edge cache. */
function MaintenanceView({ settings }: { settings: PublicSiteSettings }) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-ink px-4 py-16 text-white">
            <NoEdgeCache />
            <MaintenanceMarker />
            <div className="max-w-lg text-center">
                <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-sheet bg-white/10" aria-hidden="true">
                    <Wrench className="h-8 w-8" />
                </div>
                <h1 className="type-h1">{settings.site_name} kısa bir bakımda</h1>
                <p className="mt-3 text-base leading-7 text-white/80">
                    Sitemizi sizin için güncelliyoruz. Çok kısa süre içinde tekrar buradayız, anlayışınız için teşekkür ederiz.
                </p>
                {settings.footer_email && (
                    <a
                        href={`mailto:${settings.footer_email}`}
                        className="mt-6 inline-flex items-center gap-2 rounded-card bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/20"
                    >
                        <Mail className="h-4 w-4" aria-hidden="true" />
                        {settings.footer_email}
                    </a>
                )}
            </div>
        </div>
    )
}
