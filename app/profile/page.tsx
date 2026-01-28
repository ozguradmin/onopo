'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { User, Package, LogOut, ChevronRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileNav } from '@/components/layout/MobileNav'

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/auth/me')
            .then(res => {
                if (!res.ok) throw new Error('Not logged in')
                return res.json()
            })
            .then(data => {
                setUser(data.user)
                setLoading(false)
            })
            .catch(() => {
                router.push('/login')
            })
    }, [router])

    const handleLogout = async () => {
        if (!confirm('Çıkış yapılsın mı?')) return
        setLoading(true)
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
        router.refresh()
    }

    if (loading) {
        return (
            <>
                <Header />
                <main className="min-h-screen pt-24 pb-20 flex items-center justify-center">
                    <div className="text-slate-500">Yükleniyor...</div>
                </main>
                <MobileNav />
            </>
        )
    }

    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-slate-50">
                <div className="container mx-auto px-4 max-w-2xl">
                    {/* Profile Header */}
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center text-white text-2xl font-bold">
                                {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h1 className="text-xl font-bold text-slate-900">
                                        {user?.full_name || 'Kullanıcı'}
                                    </h1>
                                    {/* Placeholder for Edit */}
                                    <button className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                                        Düzenle
                                    </button>
                                </div>
                                <p className="text-slate-500">{user?.email}</p>
                                {user?.role === 'admin' && (
                                    <span className="inline-block mt-1 px-2 py-0.5 bg-slate-900 text-white text-xs rounded-full">
                                        Admin
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Menu Items */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <a href="/orders" className="flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                                    <Package className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Siparişlerim</p>
                                    <p className="text-sm text-slate-500">Sipariş geçmişinizi görüntüleyin</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </a>

                        {user?.role === 'admin' && (
                            <a href="/admin" className="flex items-center justify-between p-4 hover:bg-slate-50 border-b border-slate-100">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                                        <User className="w-5 h-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-slate-900">Admin Paneli</p>
                                        <p className="text-sm text-slate-500">Ürün ve sipariş yönetimi</p>
                                    </div>
                                </div>
                                <ChevronRight className="w-5 h-5 text-slate-400" />
                            </a>
                        )}

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center justify-between p-4 hover:bg-red-50 text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                                    <LogOut className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-red-600">Çıkış Yap</p>
                                    <p className="text-sm text-slate-500">Hesabınızdan güvenle çıkın</p>
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
            </main>
            <Footer />
            <MobileNav />
        </>
    )
}
