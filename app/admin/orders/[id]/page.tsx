'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Save, Package, Truck, Check, X, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const statusOptions = [
    { value: 'pending', label: 'Beklemede', icon: Clock, color: 'yellow' },
    { value: 'processing', label: 'Hazırlanıyor', icon: Package, color: 'blue' },
    { value: 'shipped', label: 'Kargoya Verildi', icon: Truck, color: 'purple' },
    { value: 'completed', label: 'Tamamlandı', icon: Check, color: 'green' },
    { value: 'cancelled', label: 'İptal Edildi', icon: X, color: 'red' },
]

export default function OrderEditPage() {
    const router = useRouter()
    const params = useParams()
    const orderId = params.id as string

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [order, setOrder] = React.useState<any>(null)
    const [formData, setFormData] = React.useState({
        status: 'pending',
        tracking_number: '',
        admin_notes: ''
    })

    React.useEffect(() => {
        fetchOrder()
    }, [orderId])

    const fetchOrder = async () => {
        try {
            const res = await fetch(`/api/orders/${orderId}`)
            if (res.ok) {
                const data = await res.json()
                setOrder(data)
                setFormData({
                    status: data.status || 'pending',
                    tracking_number: data.tracking_number || '',
                    admin_notes: data.admin_notes || ''
                })
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            if (res.ok) {
                alert('Sipariş güncellendi!')
                router.push('/admin/orders')
            } else {
                alert('Hata oluştu')
            }
        } catch (error) {
            console.error(error)
            alert('Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>
    if (!order) return <div className="p-8 text-center text-red-500">Sipariş bulunamadı</div>

    const items = order.items ? JSON.parse(order.items) : []

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                        Sipariş #{orderId}
                    </h1>
                    <p className="text-slate-500">
                        {new Date(order.created_at).toLocaleString('tr-TR')}
                    </p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Order Details */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h2 className="font-bold text-lg text-slate-900">Sipariş Bilgileri</h2>

                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-slate-500">Müşteri:</span>
                            <span className="font-medium">{order.guest_email || order.user_email || 'Kayıtlı Üye'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Telefon:</span>
                            <span className="font-medium">{order.guest_phone || '-'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Toplam Tutar:</span>
                            <span className="font-bold text-lg">{order.total_amount?.toFixed(2)} ₺</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Ödeme Yöntemi:</span>
                            <span className="font-medium">{order.payment_method || 'Belirtilmemiş'}</span>
                        </div>
                    </div>

                    <hr className="border-slate-100" />

                    <div>
                        <h3 className="font-semibold text-slate-700 mb-2">Teslimat Adresi</h3>
                        <p className="text-slate-600 text-sm">
                            {order.shipping_address || 'Adres bilgisi yok'}
                        </p>
                    </div>
                </div>

                {/* Status & Tracking */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
                    <h2 className="font-bold text-lg text-slate-900">Durum Güncelleme</h2>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Sipariş Durumu
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map(status => {
                                const Icon = status.icon
                                const isSelected = formData.status === status.value
                                return (
                                    <button
                                        key={status.value}
                                        onClick={() => setFormData({ ...formData, status: status.value })}
                                        className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left ${isSelected
                                                ? `border-${status.color}-500 bg-${status.color}-50 text-${status.color}-700`
                                                : 'border-slate-200 hover:border-slate-300'
                                            }`}
                                    >
                                        <Icon className={`w-4 h-4 ${isSelected ? `text-${status.color}-600` : 'text-slate-400'}`} />
                                        <span className="text-sm font-medium">{status.label}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Kargo Takip Numarası
                        </label>
                        <Input
                            value={formData.tracking_number}
                            onChange={e => setFormData({ ...formData, tracking_number: e.target.value })}
                            placeholder="Takip numarasını girin..."
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Müşteriye otomatik bildirim gönderilir.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Admin Notları
                        </label>
                        <textarea
                            value={formData.admin_notes}
                            onChange={e => setFormData({ ...formData, admin_notes: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm resize-none"
                            rows={3}
                            placeholder="İç kullanım için notlar..."
                        />
                    </div>

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-slate-900 hover:bg-slate-800 gap-2"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                    </Button>
                </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-lg text-slate-900 mb-4">Sipariş Ürünleri</h2>
                <div className="space-y-3">
                    {items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                            {item.image && (
                                <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
                            )}
                            <div className="flex-1">
                                <p className="font-medium text-slate-900">{item.name}</p>
                                <p className="text-sm text-slate-500">Adet: {item.quantity}</p>
                            </div>
                            <p className="font-bold text-slate-900">{(item.price * item.quantity).toFixed(2)} ₺</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
