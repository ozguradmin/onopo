'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
    LayoutDashboard,
    Home,
    FileText,
    Settings,
    BarChart3,
    Package,
    LogOut,
    Menu,
    X,
    MessageSquare,
    Users,
    FolderOpen,
    ShoppingCart,
    Ticket,
    CreditCard,
    Image as ImageIcon,
    Share2,
    Mail,
    Truck,
    Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/homepage', label: 'Ana Sayfa', icon: Home },
    { href: '/admin/products', label: 'Ürünler', icon: Package },
    { href: '/admin/categories', label: 'Kategoriler', icon: FolderOpen },
    { href: '/admin/orders', label: 'Siparişler', icon: ShoppingCart },
    { href: '/admin/analytics', label: 'İstatistikler', icon: BarChart3 },
    { href: '/admin/settings/payment', label: 'Ödeme Ayarları', icon: CreditCard },
    { href: '/admin/settings/shipping', label: 'Kargo Ayarları', icon: Truck },
    { href: '/admin/settings/integrations', label: 'Entegrasyonlar', icon: Share2 },
    { href: '/admin/pages', label: 'Sayfalar', icon: FileText },
    { href: '/admin/header', label: 'Menü Yönetimi', icon: Menu },
    { href: '/admin/reviews', label: 'Yorumlar', icon: MessageSquare },
    { href: '/admin/coupons', label: 'Kuponlar', icon: Ticket },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
    { href: '/admin/email', label: 'E-posta', icon: Mail },
    { href: '/admin/settings', label: 'Site Ayarları', icon: Settings },
    { href: '/admin/assistant', label: 'AI Asistan', icon: Sparkles },
    { href: '/admin/image-optimization', label: 'Görsel Optimizasyonu', icon: ImageIcon },
]

// Pages reachable without an admin session
const PUBLIC_ADMIN_PATHS = ['/admin/login', '/admin/reset-password']

// /api/auth/me is retried on network errors, timeouts and 5xx; only 401/403/404 mean "not logged in"
const AUTH_CHECK_TIMEOUT_MS = 10_000
const AUTH_CHECK_RETRY_DELAYS_MS = [0, 1_000, 3_000]

type AuthResult = { kind: 'admin', user: any } | { kind: 'logged-out' } | { kind: 'unreachable' }

async function checkAdminSession(isCancelled: () => boolean): Promise<AuthResult | null> {
    for (const delay of AUTH_CHECK_RETRY_DELAYS_MS) {
        if (delay) await new Promise(resolve => setTimeout(resolve, delay))
        if (isCancelled()) return null
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), AUTH_CHECK_TIMEOUT_MS)
        try {
            const res = await fetch('/api/auth/me', { cache: 'no-store', signal: controller.signal })
            if (res.status === 401 || res.status === 403 || res.status === 404) return { kind: 'logged-out' }
            if (res.ok) {
                const data = await res.json()
                return data.user?.role === 'admin' ? { kind: 'admin', user: data.user } : { kind: 'logged-out' }
            }
            // 5xx (e.g. a D1 hiccup or a cold start): retry
        } catch {
            // Network error or timeout: retry
        } finally {
            clearTimeout(timer)
        }
    }
    return { kind: 'unreachable' }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    // next.config uses trailingSlash, so the pathname may end with '/'
    const isPublicPage = PUBLIC_ADMIN_PATHS.includes(pathname.replace(/\/$/, ''))
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = React.useState(false)
    const [user, setUser] = React.useState<any>(null)
    // Set when /api/auth/me can't be reached; the admin stays on the page and can retry
    const [authError, setAuthError] = React.useState(false)
    const [retryCount, setRetryCount] = React.useState(0)

    // Re-checked on every admin page change. The panel is only rendered once the session is confirmed,
    // so a logged-out visitor never sees (or triggers the API calls of) a dashboard before the redirect.
    React.useEffect(() => {
        if (isPublicPage) return
        let cancelled = false
        checkAdminSession(() => cancelled).then(result => {
            if (cancelled || !result) return
            if (result.kind === 'admin') {
                setUser(result.user)
                setAuthError(false)
            } else if (result.kind === 'logged-out') {
                setUser(null)
                router.replace(`/admin/login/?redirect=${encodeURIComponent(pathname)}`)
            } else {
                setAuthError(true)
            }
        })
        return () => { cancelled = true }
    }, [pathname, isPublicPage, retryCount, router])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
    }

    // Don't show sidebar on login/reset pages
    if (isPublicPage) {
        return <>{children}</>
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                {authError ? (
                    <div className="max-w-sm text-center space-y-3">
                        <p className="text-slate-700 font-medium">Sunucuya ulaşılamadı.</p>
                        <p className="text-sm text-slate-500">Oturumunuz kapanmadı; bağlantı sorunu olabilir.</p>
                        <Button
                            onClick={() => { setAuthError(false); setRetryCount(c => c + 1) }}
                            className="bg-slate-900 text-white hover:bg-slate-800"
                        >
                            Tekrar Dene
                        </Button>
                    </div>
                ) : (
                    <div className="text-slate-500">Yükleniyor...</div>
                )}
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50
                w-64 bg-slate-900 text-white
                transform transition-transform duration-200 ease-in-out
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="flex flex-col h-full overflow-hidden">
                    {/* Logo - Fixed Height */}
                    <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <Link href="/admin" prefetch={false} className="text-xl font-bold truncate">
                            Onopo Admin
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation. prefetch={false}: otherwise every admin page load prefetched the RSC payload
                        of all ~17 sidebar pages (each a Worker run with an auth check) */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                        {navItems.map(item => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/admin' && pathname.startsWith(item.href))
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    prefetch={false}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-xl
                                        transition-colors font-medium
                                        ${isActive
                                            ? 'bg-white text-slate-900'
                                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                        }
                                    `}
                                >
                                    <item.icon className="w-5 h-5" />
                                    {item.label}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* User Info & Logout */}
                    <div className="p-4 border-t border-slate-800 bg-slate-900">
                        <div className="flex items-center gap-3 px-4 py-2 mb-2">
                            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold">
                                {user?.email?.[0]?.toUpperCase() || 'A'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{user?.email}</p>
                                <p className="text-xs text-slate-400">Admin</p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full
                                text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            Çıkış Yap
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content - Pushed by sidebar on desktop */}
            <div className={`flex-1 flex flex-col min-w-0 transition-all duration-200 lg:pl-64`}>
                {/* Mobile Header - Sticky */}
                <header className="lg:hidden bg-white border-b border-slate-200 px-4 h-16 flex items-center gap-4 sticky top-0 z-30">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-slate-100 rounded-lg"
                    >
                        <Menu className="w-6 h-6 text-slate-600" />
                    </button>
                    <span className="font-bold text-slate-900">Onopo Admin</span>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
                    {authError && (
                        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                            <span>Oturum kontrolü sırasında sunucuya ulaşılamadı.</span>
                            <button
                                onClick={() => { setAuthError(false); setRetryCount(c => c + 1) }}
                                className="font-semibold underline"
                            >
                                Tekrar dene
                            </button>
                        </div>
                    )}
                    {children}
                </main>
            </div>
        </div>
    )
}
