'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    Package, Eye, Trash2, Truck, Check, X, Clock,
    Mail, Phone, MapPin, AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react'

interface Order {
    id: number
    user_id: number | null
    guest_email: string
    status: string
    total_amount: number
    shipping_address: string
    tracking_code: string | null
    created_at: string
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    processing: { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700', icon: Package },
    shipped: { label: 'Kargoda', color: 'bg-purple-100 text-purple-700', icon: Truck },
    delivered: { label: 'Teslim Edildi', color: 'bg-green-100 text-green-700', icon: Check },
    cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700', icon: X }
}

export default function AdminOrdersPage() {
    const [orders, setOrders] = React.useState<Order[]>([])
    const [loading, setLoading] = React.useState(true)
    const [expandedOrder, setExpandedOrder] = React.useState<number | null>(null)
    const [trackingCode, setTrackingCode] = React.useState<Record<number, string>>({})
    const [sendingEmail, setSendingEmail] = React.useState<number | null>(null)

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/orders')
            const data = await res.json()
            setOrders(Array.isArray(data) ? data : [])
            // Initialize tracking codes
            const codes: Record<number, string> = {}
            data.forEach((o: Order) => { if (o.tracking_code) codes[o.id] = o.tracking_code })
            setTrackingCode(codes)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchOrders()
    }, [])

    const handleStatusChange = async (orderId: number, newStatus: string) => {
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            })
            fetchOrders()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDeleteOrder = async (orderId: number) => {
        if (!confirm('Bu siparişi silmek istediğinize emin misiniz?')) return
        try {
            await fetch(`/api/orders/${orderId}`, { method: 'DELETE' })
            fetchOrders()
        } catch (err) {
            console.error(err)
        }
    }

    const handleSaveTrackingCode = async (orderId: number) => {
        setSendingEmail(orderId)
        try {
            await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tracking_code: trackingCode[orderId],
                    send_notification: true
                })
            })
            alert('Kargo takip kodu kaydedildi ve müşteriye bildirim gönderildi!')
            fetchOrders()
        } catch (err) {
            console.error(err)
            alert('Hata oluştu')
        } finally {
            setSendingEmail(null)
        }
    }

    const parseAddress = (addressJson: string) => {
        try {
            return JSON.parse(addressJson)
        } catch {
            return { fullName: '', phone: '', address: addressJson }
        }
    }

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('tr-TR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Siparişler</h1>
                <span className="text-slate-500">{orders.length} sipariş</span>
            </div>

            {orders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Henüz sipariş yok</h2>
                    <p className="text-slate-500">Siparişler burada görünecek</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => {
                        const address = parseAddress(order.shipping_address)
                        const statusInfo = statusLabels[order.status] || statusLabels.pending
                        const StatusIcon = statusInfo.icon
                        const isExpanded = expandedOrder === order.id

                        return (
                            <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                {/* Order Header */}
                                <div
                                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                >
                                    <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-4 items-center">
                                        <div>
                                            <div className="text-xs text-slate-500">Sipariş No</div>
                                            <div className="font-bold text-slate-900">#{order.id}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Tarih</div>
                                            <div className="text-sm text-slate-900">{formatDate(order.created_at)}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Müşteri</div>
                                            <div className="text-sm text-slate-900 truncate">{order.guest_email}</div>
                                        </div>
                                        <div>
                                            <div className="text-xs text-slate-500">Tutar</div>
                                            <div className="font-bold text-slate-900">{order.total_amount.toFixed(2)} ₺</div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.color}`}>
                                                <StatusIcon className="w-3.5 h-3.5" />
                                                {statusInfo.label}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                                    </div>
                                </div>

                                {/* Expanded Details */}
                                {isExpanded && (
                                    <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Customer Info */}
                                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                    <Mail className="w-4 h-4 text-slate-400" />
                                                    Müşteri Bilgileri
                                                </h3>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">Ad Soyad:</span>
                                                        <span className="text-slate-900 font-medium">{address.fullName || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">E-posta:</span>
                                                        <span className="text-slate-900">{order.guest_email}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-slate-500">Telefon:</span>
                                                        <span className="text-slate-900">{address.phone || '-'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Shipping Address */}
                                            <div className="bg-white rounded-xl p-4 border border-slate-200">
                                                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-400" />
                                                    Teslimat Adresi
                                                </h3>
                                                <div className="text-sm text-slate-700">
                                                    <p>{address.address || '-'}</p>
                                                    <p>{address.district && address.city ? `${address.district}, ${address.city}` : ''}</p>
                                                    <p>{address.postalCode || ''}</p>
                                                    {address.note && (
                                                        <p className="mt-2 text-slate-500 italic">Not: {address.note}</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Tracking Code */}
                                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                <Truck className="w-4 h-4 text-slate-400" />
                                                Kargo Takip
                                            </h3>
                                            <div className="flex gap-3">
                                                <input
                                                    type="text"
                                                    value={trackingCode[order.id] || ''}
                                                    onChange={(e) => setTrackingCode(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                    placeholder="Kargo takip numarası girin..."
                                                    className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                                />
                                                <Button
                                                    onClick={() => handleSaveTrackingCode(order.id)}
                                                    disabled={sendingEmail === order.id}
                                                    className="gap-2"
                                                >
                                                    {sendingEmail === order.id ? 'Gönderiliyor...' : 'Kaydet & Bildir'}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-3 pt-2">
                                            <select
                                                value={order.status}
                                                onChange={(e) => handleStatusChange(order.id, e.target.value)}
                                                className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none bg-white"
                                            >
                                                <option value="pending">Beklemede</option>
                                                <option value="processing">Hazırlanıyor</option>
                                                <option value="shipped">Kargoda</option>
                                                <option value="delivered">Teslim Edildi</option>
                                                <option value="cancelled">İptal</option>
                                            </select>
                                            <Button
                                                variant="outline"
                                                className="text-red-600 hover:bg-red-50 border-red-200"
                                                onClick={() => handleDeleteOrder(order.id)}
                                            >
                                                <Trash2 className="w-4 h-4 mr-2" />
                                                Sil
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
