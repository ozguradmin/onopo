'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowUpRight, Search, Filter, MoreHorizontal, ChevronDown, ChevronUp, Package, Truck, Check, X, Mail, MapPin, Trash2, Clock, ExternalLink } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'

interface Order {
    id: number
    user_id: number | null
    guest_email: string
    status: string
    total_amount: number
    shipping_address: string
    tracking_number: string | null
    admin_notes: string | null
    created_at: string
    items: string | any[] // JSON string or parsed array
}

const statusLabels: Record<string, { label: string; color: string; icon: any }> = {
    pending: { label: 'Beklemede', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    processing: { label: 'Hazırlanıyor', color: 'bg-blue-100 text-blue-700', icon: Package },
    shipped: { label: 'Kargoda', color: 'bg-purple-100 text-purple-700', icon: Truck },
    delivered: { label: 'Teslim Edildi', color: 'bg-green-100 text-green-700', icon: Check },
    cancelled: { label: 'İptal', color: 'bg-red-100 text-red-700', icon: X }
}

export default function AdminOrdersPage() {
    return (
        <React.Suspense fallback={<div>Yükleniyor...</div>}>
            <OrdersContent />
        </React.Suspense>
    )
}

function OrdersContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const highlightId = searchParams.get('id')

    const [orders, setOrders] = React.useState<Order[]>([])
    const [loading, setLoading] = React.useState(true)
    const [expandedOrder, setExpandedOrder] = React.useState<number | null>(null)
    const [trackingCode, setTrackingCode] = React.useState<Record<number, string>>({})
    const [sendingEmail, setSendingEmail] = React.useState<number | null>(null)

    // Search and Filter state
    const [searchQuery, setSearchQuery] = React.useState('')
    const [statusFilter, setStatusFilter] = React.useState('')

    // Pagination state
    const [currentPage, setCurrentPage] = React.useState(1)
    const [pageSize, setPageSize] = React.useState(10)

    const fetchOrders = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/orders')
            const data = await res.json()
            setOrders(Array.isArray(data) ? data : [])
            // Initialize tracking codes
            const codes: Record<number, string> = {}
            data.forEach((o: Order) => { if (o.tracking_number) codes[o.id] = o.tracking_number })
            setTrackingCode(codes)

            // Auto expand if highlighted
            if (highlightId) {
                const id = parseInt(highlightId)
                if (data.find((o: Order) => o.id === id)) {
                    setExpandedOrder(id)
                }
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchOrders()
    }, [])

    // Filtered orders
    const filteredOrders = React.useMemo(() => {
        return orders.filter(order => {
            const matchesSearch = searchQuery === '' ||
                order.id.toString().includes(searchQuery) ||
                order.guest_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                order.tracking_number?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesStatus = statusFilter === '' || order.status === statusFilter
            return matchesSearch && matchesStatus
        })
    }, [orders, searchQuery, statusFilter])

    // Paginated orders
    const paginatedOrders = React.useMemo(() => {
        if (pageSize === 0) return filteredOrders // 0 means "all"
        const start = (currentPage - 1) * pageSize
        return filteredOrders.slice(start, start + pageSize)
    }, [filteredOrders, currentPage, pageSize])

    const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredOrders.length / pageSize)

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, statusFilter, pageSize])

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
                    tracking_number: trackingCode[orderId],
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
        if (!dateStr) return '-'
        // Ensure date is treated as UTC
        const normalized = dateStr.replace(' ', 'T')
        const utcDate = normalized.endsWith('Z') ? normalized : `${normalized}Z`

        return new Date(utcDate).toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
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
                <span className="text-slate-500">{filteredOrders.length} sipariş</span>
            </div>

            {/* Search and Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Sipariş no, e-posta veya takip kodu ile ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-w-[160px]"
                >
                    <option value="">Tüm Durumlar</option>
                    <option value="pending">Beklemede</option>
                    <option value="processing">Hazırlanıyor</option>
                    <option value="shipped">Kargoda</option>
                    <option value="delivered">Teslim Edildi</option>
                    <option value="cancelled">İptal</option>
                </select>
                <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                    <option value={10}>10 / sayfa</option>
                    <option value={20}>20 / sayfa</option>
                    <option value={40}>40 / sayfa</option>
                    <option value={80}>80 / sayfa</option>
                    <option value={0}>Tümü</option>
                </select>
                {(searchQuery || statusFilter) && (
                    <Button
                        variant="ghost"
                        onClick={() => { setSearchQuery(''); setStatusFilter(''); }}
                        className="text-slate-500"
                    >
                        Temizle
                    </Button>
                )}
            </div>

            {/* Results info */}
            <p className="text-sm text-slate-500">
                {filteredOrders.length} sipariş bulundu
                {pageSize > 0 && ` (Sayfa ${currentPage}/${totalPages})`}
            </p>

            {paginatedOrders.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h2 className="text-lg font-semibold text-slate-900 mb-2">Sipariş bulunamadı</h2>
                    <p className="text-slate-500">Arama kriterlerinize uygun sipariş yok</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {paginatedOrders.map(order => {
                        const address = parseAddress(order.shipping_address)
                        const statusInfo = statusLabels[order.status] || statusLabels.pending
                        const StatusIcon = statusInfo.icon
                        const isExpanded = expandedOrder === order.id

                        return (
                            <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                {/* Order Header */}
                                <div
                                    className="p-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50"
                                    onClick={() => router.push(`/admin/orders/${order.id}`)}
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
                                        <ExternalLink className="w-5 h-5 text-slate-400" />
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

                                        {/* Products */}
                                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                <Package className="w-4 h-4 text-slate-400" />
                                                Sipariş Ürünleri
                                            </h3>
                                            <div className="space-y-3">
                                                {order.items && (typeof order.items === 'string' ? JSON.parse(order.items) : order.items).map((item: any, idx: number) => (
                                                    <div key={idx} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                                        <a href={`/admin/products/${item.id}/edit`} className="shrink-0 hover:opacity-80 transition-opacity">
                                                            {item.image ? (
                                                                <img src={item.image} alt={item.name} className="w-12 h-12 rounded bg-white object-cover" />
                                                            ) : (
                                                                <div className="w-12 h-12 rounded bg-white flex items-center justify-center text-slate-300">
                                                                    <Package className="w-6 h-6" />
                                                                </div>
                                                            )}
                                                        </a>
                                                        <div className="flex-1 min-w-0">
                                                            <a href={`/admin/products/${item.id}/edit`} className="text-sm font-medium text-slate-900 truncate block hover:text-blue-600 transition-colors">
                                                                {item.name}
                                                            </a>
                                                            <p className="text-xs text-slate-500">Adet: {item.quantity} x {item.price.toFixed(2)} ₺</p>
                                                        </div>
                                                        <div className="font-semibold text-slate-900 text-sm">
                                                            {(item.quantity * item.price).toFixed(2)} ₺
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Tracking Code */}
                                        <div className="bg-white rounded-xl p-4 border border-slate-200">
                                            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                                                <Truck className="w-4 h-4 text-slate-400" />
                                                Kargo Takip
                                            </h3>
                                            {/* Display existing tracking number as clickable link */}
                                            {order.tracking_number && (
                                                <div className="mb-3 p-3 bg-green-50 border border-green-100 rounded-lg">
                                                    <p className="text-sm text-green-700 mb-1">Mevcut Takip Kodu:</p>
                                                    <a
                                                        href={`https://kargotakip.araskargo.com.tr/mainpage.aspx?code=${order.tracking_number}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-600 hover:text-blue-800 font-mono font-bold text-lg underline"
                                                    >
                                                        {order.tracking_number} ↗
                                                    </a>
                                                </div>
                                            )}
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                    >
                        Önceki
                    </Button>
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                            let page: number
                            if (totalPages <= 5) {
                                page = i + 1
                            } else if (currentPage <= 3) {
                                page = i + 1
                            } else if (currentPage >= totalPages - 2) {
                                page = totalPages - 4 + i
                            } else {
                                page = currentPage - 2 + i
                            }
                            return (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? undefined : 'outline'}
                                    onClick={() => setCurrentPage(page)}
                                    className="w-10"
                                >
                                    {page}
                                </Button>
                            )
                        })}
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Sonraki
                    </Button>
                </div>
            )}
        </div>
    )
}
