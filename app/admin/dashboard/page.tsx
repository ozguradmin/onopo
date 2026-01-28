'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Edit, Trash2, Plus, TrendingUp, Users, Package, DollarSign } from 'lucide-react'

export default function AdminDashboard() {
    const router = useRouter()
    const [orders, setOrders] = React.useState<any[]>([])
    const [stats, setStats] = React.useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, todayViews: 0 })
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/admin/dashboard-stats')
            .then(res => res.json())
            .then(data => {
                if (data.stats) setStats(data.stats)
                if (Array.isArray(data.recentOrders)) setOrders(data.recentOrders)
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-8">
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

            {/* Recent Orders */}
            <section>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-slate-900">Son Siparişler</h2>
                    <Button variant="outline" size="sm" onClick={() => router.push('/admin/orders')}>Tümünü Gör</Button>
                </div>
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
                            {orders.map(order => (
                                <tr
                                    key={order.id}
                                    className="hover:bg-slate-50 cursor-pointer"
                                    onClick={() => router.push(`/admin/orders?id=${order.id}`)}
                                >
                                    <td className="p-4 font-mono font-medium text-slate-500">#{order.id}</td>
                                    <td className="p-4 text-slate-900">{order.guest_email || 'Kayıtlı Üye'}</td>
                                    <td className="p-4 font-bold text-slate-900">{order.total_amount?.toFixed(2)} ₺</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase
                                            ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                                            ${order.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                                            ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                                            ${order.status === 'shipped' ? 'bg-purple-100 text-purple-700' : ''}
                                        `}>
                                            {order.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={4} className="p-8 text-center text-slate-500">{loading ? 'Yükleniyor...' : 'Henüz sipariş yok.'}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
