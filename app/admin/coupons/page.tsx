
'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Tag, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [formData, setFormData] = useState({
        code: '',
        discount_type: 'fixed',
        discount_value: '',
        min_spend: '',
        usage_limit: '',
        expires_at: ''
    })

    useEffect(() => {
        fetchCoupons()
    }, [])

    const fetchCoupons = async () => {
        try {
            const res = await fetch('/api/admin/coupons')
            const data = await res.json()
            setCoupons(Array.isArray(data) ? data : [])
        } catch (error) {
            console.error('Error fetching coupons:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch('/api/admin/coupons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    discount_value: parseFloat(formData.discount_value),
                    min_spend: formData.min_spend ? parseFloat(formData.min_spend) : 0,
                    usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : 0
                })
            })

            if (res.ok) {
                setShowForm(false)
                fetchCoupons()
                setFormData({
                    code: '',
                    discount_type: 'fixed',
                    discount_value: '',
                    min_spend: '',
                    usage_limit: '',
                    expires_at: ''
                })
            } else {
                alert('Kupon oluşturulurken hata oluştu')
            }
        } catch (error) {
            console.error('Error creating coupon:', error)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Bu kuponu silmek istediğinize emin misiniz?')) return
        try {
            const res = await fetch(`/api/admin/coupons/${id}`, { method: 'DELETE' })
            if (res.ok) fetchCoupons()
        } catch (error) {
            console.error('Error deleting coupon:', error)
        }
    }

    const toggleStatus = async (id: number, currentStatus: number) => {
        try {
            await fetch(`/api/admin/coupons/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !currentStatus })
            })
            fetchCoupons()
        } catch (error) {
            console.error('Error toggling status:', error)
        }
    }

    if (loading) return <div className="p-8">Yükleniyor...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Kupon Yönetimi</h1>
                    <p className="text-slate-500">İndirim kuponlarını buradan yönetebilirsiniz.</p>
                </div>
                <Button onClick={() => setShowForm(!showForm)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    {showForm ? 'Vazgeç' : 'Yeni Kupon'}
                </Button>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <h2 className="font-semibold mb-4 text-lg">Yeni Kupon Oluştur</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-1 block">Kupon Kodu</label>
                            <Input
                                placeholder="Örn: YAZindirim20"
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">İndirim Tipi</label>
                            <select
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={formData.discount_type}
                                onChange={e => setFormData({ ...formData, discount_type: e.target.value })}
                            >
                                <option value="fixed">Sabit Tutar (TL)</option>
                                <option value="percent">Yüzde (%)</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">İndirim Değeri</label>
                            <Input
                                type="number"
                                placeholder="Örn: 50 veya 10"
                                value={formData.discount_value}
                                onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Min. Sepet Tutarı (Opsiyonel)</label>
                            <Input
                                type="number"
                                placeholder="Örn: 500"
                                value={formData.min_spend}
                                onChange={e => setFormData({ ...formData, min_spend: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Kullanım Limiti (Opsiyonel)</label>
                            <Input
                                type="number"
                                placeholder="Örn: 100 (Sınırsız için boş bırakın)"
                                value={formData.usage_limit}
                                onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-1 block">Son Kullanma Tarihi (Opsiyonel)</label>
                            <Input
                                type="datetime-local"
                                value={formData.expires_at}
                                onChange={e => setFormData({ ...formData, expires_at: e.target.value })}
                            />
                        </div>
                        <div className="md:col-span-2 pt-2">
                            <Button type="submit" className="w-full">Oluştur</Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-4 font-medium text-slate-500">KOD</th>
                            <th className="p-4 font-medium text-slate-500">İndirim</th>
                            <th className="p-4 font-medium text-slate-500">Koşullar</th>
                            <th className="p-4 font-medium text-slate-500">Durum</th>
                            <th className="p-4 font-medium text-slate-500 text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {coupons.map((coupon) => (
                            <tr key={coupon.id} className="hover:bg-slate-50/50">
                                <td className="p-4">
                                    <div className="font-bold flex items-center gap-2">
                                        <Ticket className="w-4 h-4 text-blue-500" />
                                        {coupon.code}
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        {new Date(coupon.created_at).toLocaleDateString()}
                                    </div>
                                </td>
                                <td className="p-4">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 hover:bg-blue-100">
                                        {coupon.discount_type === 'percent' ? '%' : '₺'}
                                        {coupon.discount_value}
                                    </Badge>
                                </td>
                                <td className="p-4 text-slate-600">
                                    {coupon.min_spend > 0 && <div>Min: {coupon.min_spend} TL</div>}
                                    {coupon.usage_limit > 0 && <div>Limit: {coupon.usage_limit}</div>}
                                    {coupon.expires_at && <div>SKT: {new Date(coupon.expires_at).toLocaleDateString()}</div>}
                                    {!coupon.min_spend && !coupon.usage_limit && !coupon.expires_at && <span>-</span>}
                                </td>
                                <td className="p-4">
                                    <button
                                        onClick={() => toggleStatus(coupon.id, coupon.is_active)}
                                        className={`px-2 py-1 rounded text-xs font-semibold ${coupon.is_active
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'}`}
                                    >
                                        {coupon.is_active ? 'Aktif' : 'Pasif'}
                                    </button>
                                </td>
                                <td className="p-4 text-right">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleDelete(coupon.id)}
                                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </td>
                            </tr>
                        ))}
                        {coupons.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">
                                    Henüz hiç kupon oluşturulmamış.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
