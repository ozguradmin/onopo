'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PackageOpen, Package, Truck, CheckCircle, Clock, ExternalLink } from 'lucide-react'
import { formatPrice } from '@/lib/formatPrice'

interface Order {
    id: number
    status: string
    total_amount: number
    items: string | any[]
    tracking_number?: string
    note?: string
    created_at: string
    shipping_address?: string
    city?: string
    district?: string
}

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-4 h-4" /> },
    processing: { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700', icon: <Package className="w-4 h-4" /> },
    shipped: { label: 'Kargoda', color: 'bg-purple-100 text-purple-700', icon: <Truck className="w-4 h-4" /> },
    delivered: { label: 'Teslim Edildi', color: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-4 h-4" /> },
    cancelled: { label: 'İptal Edildi', color: 'bg-red-100 text-red-700', icon: <PackageOpen className="w-4 h-4" /> },
}

export default function OrdersPage() {
    const router = useRouter()
    const [orders, setOrders] = React.useState<Order[]>([])
    const [loading, setLoading] = React.useState(true)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
        // Check auth first
        fetch('/api/auth/me')
            .then(res => {
                if (!res.ok) throw new Error('Not logged in')
                return res.json()
            })
            .then(() => {
                // Then fetch orders
                return fetch('/api/orders/my-orders')
            })
            .then(res => {
                if (!res.ok) throw new Error('Failed to fetch orders')
                return res.json()
            })
            .then(data => {
                setOrders(data.orders || [])
                setLoading(false)
            })
            .catch((err) => {
                if (err.message === 'Not logged in') {
                    router.push('/login?redirect=/orders')
                } else {
                    setError(err.message)
                    setLoading(false)
                }
            })
    }, [router])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-24">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-24">
                <div className="text-red-500">{error}</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-8 pt-28">
            <div className="container mx-auto px-4 max-w-4xl">
                <h1 className="text-2xl font-bold text-slate-900 mb-6">Siparişlerim</h1>

                {orders.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PackageOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">Henüz siparişiniz yok</h2>
                        <p className="text-slate-500 mb-6">
                            Verdiğiniz siparişler burada listelenecektir.
                        </p>
                        <Link href="/products" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-8 text-sm font-medium text-slate-50 hover:bg-slate-900/90 shadow-sm transition-colors">
                            Alışverişe Başla
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {orders.map(order => {
                            const statusInfo = statusLabels[order.status] || statusLabels.pending
                            const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
                            // Extract note - check direct field first, then shipping_address JSON
                            let orderNote = order.note
                            if (!orderNote && order.shipping_address) {
                                try {
                                    const addr = typeof order.shipping_address === 'string'
                                        ? JSON.parse(order.shipping_address)
                                        : order.shipping_address
                                    orderNote = addr.note
                                } catch { }
                            }

                            return (
                                <div key={order.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                                    {/* Order Header */}
                                    <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm text-slate-500">Sipariş No</p>
                                            <p className="font-bold text-slate-900">#{order.id}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">Tarih</p>
                                            <p className="font-medium text-slate-700">
                                                {new Date(order.created_at).toLocaleDateString('tr-TR')}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-500">Toplam</p>
                                            <p className="font-bold text-slate-900">{formatPrice(order.total_amount)}</p>
                                        </div>
                                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusInfo.color}`}>
                                            {statusInfo.icon}
                                            {statusInfo.label}
                                        </div>
                                    </div>

                                    {/* Order Items */}
                                    <div className="p-4">
                                        <p className="text-sm font-medium text-slate-700 mb-3">Ürünler</p>
                                        <div className="space-y-2">
                                            {items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                                    {item.image ? (
                                                        <img src={item.image} alt={item.name} className="w-12 h-12 rounded bg-white object-cover" />
                                                    ) : (
                                                        <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-slate-300">
                                                            <Package className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                                                        <p className="text-xs text-slate-500">Adet: {item.quantity}</p>
                                                    </div>
                                                    <div className="font-semibold text-slate-900 text-sm">
                                                        {formatPrice(item.price * item.quantity)}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Tracking Number */}
                                    {order.tracking_number && (
                                        <div className="px-4 pb-4">
                                            <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl">
                                                <p className="text-sm text-purple-700 mb-1">Kargo Takip Numarası (Aras Kargo)</p>
                                                <a
                                                    href={`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${order.tracking_number}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 font-mono font-bold text-lg"
                                                >
                                                    {order.tracking_number}
                                                    <ExternalLink className="w-4 h-4" />
                                                </a>
                                            </div>
                                        </div>
                                    )}

                                    {/* Order Note */}
                                    {orderNote && (
                                        <div className="px-4 pb-4">
                                            <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                                                <p className="text-sm text-amber-700 mb-1">Sipariş Notunuz</p>
                                                <p className="text-sm text-amber-900">{orderNote}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
