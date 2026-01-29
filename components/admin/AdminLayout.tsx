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
    Ticket
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/homepage', label: 'Ana Sayfa', icon: Home },
    { href: '/admin/products', label: 'Ürünler', icon: Package },
    { href: '/admin/categories', label: 'Kategoriler', icon: FolderOpen },
    { href: '/admin/orders', label: 'Siparişler', icon: ShoppingCart },
    { href: '/admin/pages', label: 'Sayfalar', icon: FileText },
    { href: '/admin/header', label: 'Menü Yönetimi', icon: Menu },
    { href: '/admin/reviews', label: 'Yorumlar', icon: MessageSquare },
    { href: '/admin/coupons', label: 'Kuponlar', icon: Ticket },
    { href: '/admin/users', label: 'Kullanıcılar', icon: Users },
    { href: '/admin/settings', label: 'Site Ayarları', icon: Settings },
    { href: '/admin/analytics', label: 'İstatistikler', icon: BarChart3 },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [sidebarOpen, setSidebarOpen] = React.useState(false)
    const [user, setUser] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        if (pathname === '/admin/login') {
            setLoading(false)
            return
        }
        fetch('/api/auth/me')
            .then(res => {
                if (!res.ok) throw new Error('Not logged in')
                return res.json()
            })
            .then(data => {
                if (data.user?.role !== 'admin') {
                    router.push('/admin/login')
                    return
                }
                setUser(data.user)
                setLoading(false)
            })
            .catch(() => {
                setLoading(false)
                router.push('/admin/login')
            })
    }, [router])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
    }

    if (loading && pathname !== '/admin/login') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    // Don't show sidebar on login page
    if (pathname === '/admin/login') {
        return <>{children}</>
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
                        <Link href="/admin" className="text-xl font-bold truncate">
                            Onopo Admin
                        </Link>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden p-2 hover:bg-slate-800 rounded-lg"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto custom-scrollbar">
                        {navItems.map(item => {
                            const isActive = pathname === item.href ||
                                (item.href !== '/admin' && pathname.startsWith(item.href))
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
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
                    {children}
                </main>
            </div>
        </div>
    )
}
