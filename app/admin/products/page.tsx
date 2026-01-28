'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Plus } from 'lucide-react'
import { formatPrice } from '@/lib/formatPrice'

export default function AdminProductsPage() {
    const router = useRouter()
    const [products, setProducts] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/products')
            .then(r => r.json())
            .then(data => {
                setProducts(data || [])
                setLoading(false)
            })
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
        await fetch(`/api/products/${id}`, { method: 'DELETE' })
        setProducts(products.filter(p => p.id !== id))
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Ürünler</h1>
                <Button
                    onClick={() => router.push('/admin/products/new')}
                    className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
                >
                    <Plus className="w-4 h-4" /> Yeni Ürün
                </Button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold text-slate-700">Resim</th>
                                <th className="p-4 font-semibold text-slate-700">İsim</th>
                                <th className="p-4 font-semibold text-slate-700">Kategori</th>
                                <th className="p-4 font-semibold text-slate-700">Fiyat</th>
                                <th className="p-4 font-semibold text-slate-700">Stok</th>
                                <th className="p-4 font-semibold text-slate-700 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {products.map(product => (
                                <tr key={product.id} className="hover:bg-slate-50">
                                    <td className="p-4">
                                        <img
                                            src={product.images?.[0] || '/placeholder.svg'}
                                            className="w-12 h-12 rounded-lg object-cover bg-slate-100"
                                        />
                                    </td>
                                    <td className="p-4 font-medium text-slate-900">{product.name}</td>
                                    <td className="p-4 text-slate-600">{product.category || '-'}</td>
                                    <td className="p-4 text-slate-600">{formatPrice(product.price)}</td>
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
                                            onClick={() => handleDelete(product.id)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {products.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Henüz ürün yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
