'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, TrendingUp, Package, DollarSign, Plus, Edit, Trash2, Wrench, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminDashboard() {
    const router = useRouter()
    const [products, setProducts] = React.useState<any[]>([])
    const [orders, setOrders] = React.useState<any[]>([])
    const [stats, setStats] = React.useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, todayViews: 0 })
    const [maintenanceMode, setMaintenanceMode] = React.useState(false)
    const [savingMaintenance, setSavingMaintenance] = React.useState(false)

    React.useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()).catch(() => []),
            fetch('/api/orders').then(r => r.json()).catch(() => []),
            fetch('/api/analytics?range=day').then(r => r.json()).catch(() => ({ totalViews: 0 })),
            fetch('/api/site-settings').then(r => r.json()).catch(() => ({}))
        ]).then(([prods, ords, analytics, settings]) => {
            setProducts(prods || [])
            setOrders(ords || [])
            const revenue = (ords || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
            setStats({
                totalProducts: prods?.length || 0,
                totalOrders: ords?.length || 0,
                totalRevenue: revenue,
                todayViews: analytics?.totalViews || 0
            })
            setMaintenanceMode(settings?.maintenance_mode === 'true' || settings?.maintenance_mode === true)
        })
    }, [])

    const handleDeleteProduct = async (id: number) => {
        if (!confirm('Emin misiniz?')) return
        await fetch(`/api/products/${id}`, { method: 'DELETE' })
        setProducts(products.filter(p => p.id !== id))
    }

    const toggleMaintenanceMode = async () => {
        setSavingMaintenance(true)
        const newValue = !maintenanceMode
        try {
            const res = await fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maintenance_mode: newValue ? 'true' : 'false' })
            })
            if (res.ok) {
                setMaintenanceMode(newValue)
                toast.success(newValue ? 'Site bakıma alındı!' : 'Site yayına açıldı!')
            } else {
                toast.error('Ayar kaydedilemedi')
            }
        } catch {
            toast.error('Bir hata oluştu')
        } finally {
            setSavingMaintenance(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Maintenance Mode Alert */}
            {maintenanceMode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <div className="flex-1">
                        <p className="font-semibold text-yellow-800">Site Bakım Modunda</p>
                        <p className="text-sm text-yellow-700">Ziyaretçiler bakım sayfasını görüyor. Siteyi açmak için aşağıdaki butonu kullanın.</p>
                    </div>
                    <Button
                        onClick={toggleMaintenanceMode}
                        disabled={savingMaintenance}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        Siteyi Aç
                    </Button>
                </div>
            )}

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Package className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Toplam Ürün</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.totalProducts}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                            <ShoppingBag className="w-6 h-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Toplam Sipariş</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.totalOrders}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                            <DollarSign className="w-6 h-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Toplam Gelir</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.totalRevenue.toFixed(0)} ₺</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                            <TrendingUp className="w-6 h-6 text-orange-600" />
                        </div>
                        <div>
                            <p className="text-sm text-slate-500">Bugün Görüntülenme</p>
                            <p className="text-2xl font-bold text-slate-900">{stats.todayViews}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <section>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Hızlı İşlemler</h2>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                    <Button
                        onClick={() => router.push('/admin/products/new')}
                        className="h-auto py-4 flex-col gap-2 bg-slate-900 text-white hover:bg-slate-800"
                    >
                        <Plus className="w-6 h-6" />
                        <span>Yeni Ürün Ekle</span>
                    </Button>
                    <Button
                        onClick={() => router.push('/admin/homepage')}
                        variant="outline"
                        className="h-auto py-4 flex-col gap-2"
                    >
                        <Edit className="w-6 h-6" />
                        <span>Ana Sayfayı Düzenle</span>
                    </Button>
                    <Button
                        onClick={() => router.push('/admin/homepage/hero')}
                        variant="outline"
                        className="h-auto py-4 flex-col gap-2"
                    >
                        <Edit className="w-6 h-6" />
                        <span>Hero Slider</span>
                    </Button>
                    <Button
                        onClick={() => router.push('/admin/settings')}
                        variant="outline"
                        className="h-auto py-4 flex-col gap-2"
                    >
                        <Edit className="w-6 h-6" />
                        <span>Site Ayarları</span>
                    </Button>
                    <Button
                        onClick={toggleMaintenanceMode}
                        disabled={savingMaintenance}
                        variant="outline"
                        className={`h-auto py-4 flex-col gap-2 ${maintenanceMode ? 'border-green-500 text-green-600 hover:bg-green-50' : 'border-yellow-500 text-yellow-600 hover:bg-yellow-50'}`}
                    >
                        <Wrench className="w-6 h-6" />
                        <span>{maintenanceMode ? 'Siteyi Aç' : 'Bakıma Al'}</span>
                    </Button>
                </div>
            </section>

            {/* Recent Orders */}
            <section>
                <h2 className="text-xl font-bold text-slate-900 mb-4">Son Siparişler</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold text-slate-700">Sipariş No</th>
                                <th className="p-4 font-semibold text-slate-700">Kullanıcı</th>
                                <th className="p-4 font-semibold text-slate-700">Tutar</th>
                                <th className="p-4 font-semibold text-slate-700">Durum</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.slice(0, 5).map(order => (
                                <tr
                                    key={order.id}
                                    className="hover:bg-slate-50 cursor-pointer"
                                    onClick={() => router.push(`/admin/orders/${order.id}`)}
                                >
                                    <td className="p-4 font-mono font-medium text-slate-500">#{order.id}</td>
                                    <td className="p-4 text-slate-900">{order.guest_email || 'Kayıtlı Üye'}</td>
                                    <td className="p-4 font-bold text-slate-900">{order.total_amount?.toFixed(2)} ₺</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase
                                            ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                                            ${order.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                                            ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                                        `}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">Henüz sipariş yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
