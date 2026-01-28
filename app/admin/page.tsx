'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Edit, Trash2, Plus } from 'lucide-react'

export default function AdminDashboard() {
    const router = useRouter()
    const [products, setProducts] = React.useState<any[]>([])
    const [orders, setOrders] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        const fetchData = async () => {
            try {
                // Check Auth via /api/auth/me
                const meRes = await fetch('/api/auth/me')
                if (!meRes.ok) {
                    router.push('/admin/login')
                    return
                }
                const me = await meRes.json()
                if (me.user?.role !== 'admin') {
                    // Not admin - redirect to admin login (not home)
                    router.push('/admin/login')
                    return
                }

                const [prodRes, ordRes] = await Promise.all([
                    fetch('/api/products'),
                    fetch('/api/orders')
                ])

                if (prodRes.ok) setProducts(await prodRes.json())
                if (ordRes.ok) setOrders(await ordRes.json())

            } catch (e) {
                console.error(e)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [])

    const handleDeleteProduct = async (id: number) => {
        if (!confirm('Emin misiniz?')) return
        await fetch(`/api/products/${id}`, { method: 'DELETE' })
        setProducts(products.filter(p => p.id !== id))
    }

    if (loading) return <div className="p-8 text-center">Yükleniyor...</div>

    return (
        <div className="space-y-12">
            {/* Products Section */}
            <section>
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-900">Ürünler</h2>
                    <Button onClick={() => router.push('/admin/products/new')} className="gap-2 bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="w-4 h-4" /> Yeni Ürün
                    </Button>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold text-slate-700">Resim</th>
                                <th className="p-4 font-semibold text-slate-700">İsim</th>
                                <th className="p-4 font-semibold text-slate-700">Fiyat</th>
                                <th className="p-4 font-semibold text-slate-700">Stok</th>
                                <th className="p-4 font-semibold text-slate-700 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(product => (
                                <tr key={product.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        {/* Show first image from JSON array */}
                                        <img
                                            src={product.images && product.images.length > 0 ? product.images[0] : ''}
                                            className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                                        />
                                    </td>
                                    <td className="p-4 font-medium text-slate-900">{product.name}</td>
                                    <td className="p-4 text-slate-600">{product.price.toFixed(2)} ₺</td>
                                    <td className="p-4 text-slate-600">{product.stock}</td>
                                    <td className="p-4 text-right space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-blue-600"
                                            onClick={() => router.push(`/admin/products/${product.id}/edit`)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-500 hover:text-red-600"
                                            onClick={() => handleDeleteProduct(product.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Orders Section */}
            <section>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Siparişler</h2>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold text-slate-700">Sipariş No</th>
                                <th className="p-4 font-semibold text-slate-700">Kullanıcı</th>
                                <th className="p-4 font-semibold text-slate-700">Tutar</th>
                                <th className="p-4 font-semibold text-slate-700">Durum</th>
                                <th className="p-4 font-semibold text-slate-700">Tarih</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {orders.map(order => (
                                <tr key={order.id} className="hover:bg-slate-50">
                                    <td className="p-4 font-mono font-medium text-slate-500">#{order.id}</td>
                                    <td className="p-4 text-slate-900">{order.guest_email || 'Kayıtlı Üye'}</td>
                                    <td className="p-4 font-bold text-slate-900">{order.total_amount.toFixed(2)} ₺</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase
                                            ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : ''}
                                            ${order.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                                            ${order.status === 'cancelled' ? 'bg-red-100 text-red-700' : ''}
                                        `}>
                                            {order.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-slate-500 text-sm">
                                        {new Date(order.created_at).toLocaleDateString()}
                                    </td>
                                </tr>
                            ))}
                            {orders.length === 0 && (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Henüz sipariş yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
