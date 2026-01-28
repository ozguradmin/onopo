'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { User, Heart, Package, LogOut, ChevronRight, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/formatPrice'

export default function ProfilePage() {
    const router = useRouter()
    const [user, setUser] = React.useState<any>(null)
    const [favorites, setFavorites] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [activeTab, setActiveTab] = React.useState<'profile' | 'favorites'>('profile')

    React.useEffect(() => {
        // Check auth
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
                router.push('/login?redirect=/profile')
            })

        // Fetch favorites
        fetch('/api/favorites')
            .then(res => res.json())
            .then(data => {
                if (data.favorites) setFavorites(data.favorites)
            })
            .catch(console.error)
    }, [router])

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.push('/')
    }

    const removeFavorite = async (productId: number) => {
        await fetch('/api/favorites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId })
        })
        setFavorites(favorites.filter(f => f.product_id !== productId))
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8">
            <div className="container mx-auto px-4 max-w-4xl">
                {/* Header */}
                <div className="bg-white rounded-2xl p-6 mb-6 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center text-white text-2xl font-bold">
                            {user?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1">
                            <h1 className="text-xl font-bold text-slate-900">{user?.full_name || 'Kullanıcı'}</h1>
                            <p className="text-slate-500">{user?.email}</p>
                            {user?.role === 'admin' && (
                                <span className="inline-block mt-1 px-2 py-0.5 bg-slate-900 text-white text-xs rounded-full">
                                    Admin
                                </span>
                            )}
                        </div>
                        <Button variant="outline" onClick={handleLogout} className="gap-2">
                            <LogOut className="w-4 h-4" />
                            Çıkış Yap
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setActiveTab('profile')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === 'profile'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        <User className="w-4 h-4" />
                        Profilim
                    </button>
                    <button
                        onClick={() => setActiveTab('favorites')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === 'favorites'
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                            }`}
                    >
                        <Heart className="w-4 h-4" />
                        Beğendiklerim
                        {favorites.length > 0 && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                {favorites.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Content */}
                {activeTab === 'profile' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        {/* Menu Items */}
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

                        <Link href="/products" className="flex items-center justify-between p-4 hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                                    <ShoppingBag className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-slate-900">Alışverişe Devam Et</p>
                                    <p className="text-sm text-slate-500">Ürünlere göz atın</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                        </Link>
                    </div>
                )}

                {activeTab === 'favorites' && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                        <h2 className="text-lg font-bold text-slate-900 mb-4">
                            Beğendiğim Ürünler ({favorites.length})
                        </h2>

                        {favorites.length === 0 ? (
                            <div className="text-center py-12">
                                <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                <p className="text-slate-500 mb-4">Henüz beğendiğiniz ürün yok</p>
                                <Link href="/products">
                                    <Button className="bg-slate-900 text-white hover:bg-slate-800">
                                        Ürünlere Göz At
                                    </Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {favorites.map(product => (
                                    <div key={product.product_id} className="group relative bg-slate-50 rounded-xl overflow-hidden">
                                        <Link href={`/product/${product.product_id}`}>
                                            <div className="aspect-square relative">
                                                <img
                                                    src={product.images?.[0] || '/placeholder.png'}
                                                    alt={product.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                            <div className="p-3">
                                                <h3 className="font-medium text-slate-900 text-sm line-clamp-2 mb-1">
                                                    {product.name}
                                                </h3>
                                                <p className="font-bold text-slate-900">
                                                    {formatPrice(product.price)}
                                                </p>
                                            </div>
                                        </Link>
                                        <button
                                            onClick={() => removeFavorite(product.product_id)}
                                            className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition-colors"
                                        >
                                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
