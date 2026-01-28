'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Edit, Trash2, Plus, TrendingUp, Users, Package, DollarSign } from 'lucide-react'

export default function AdminDashboard() {
    const router = useRouter()
    const [products, setProducts] = React.useState<any[]>([])
    const [orders, setOrders] = React.useState<any[]>([])
    const [stats, setStats] = React.useState({ totalProducts: 0, totalOrders: 0, totalRevenue: 0, todayViews: 0 })

    React.useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/orders').then(r => r.json()),
            fetch('/api/analytics?range=day').then(r => r.json()).catch(() => ({ totalViews: 0 }))
        ]).then(([prods, ords, analytics]) => {
            setProducts(prods || [])
            setOrders(ords || [])
            const revenue = (ords || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0)
            setStats({
                totalProducts: prods?.length || 0,
                totalOrders: ords?.length || 0,
                totalRevenue: revenue,
                todayViews: analytics?.totalViews || 0
            })
        })
    }, [])

    const handleDeleteProduct = async (id: number) => {
        if (!confirm('Emin misiniz?')) return
        await fetch(`/api/products/${id}`, { method: 'DELETE' })
        setProducts(products.filter(p => p.id !== id))
    }

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
                                <tr key={order.id} className="hover:bg-slate-50">
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
