'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Plus, Upload, Trash, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/formatPrice'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

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
        toast.success('Ürün silindi')
    }

    const handleBulkDelete = async () => {
        const confirm1 = confirm('TÜM ÜRÜNLERİ silmek üzeresiniz! Bu işlem geri alınamaz.')
        if (!confirm1) return
        const confirm2 = confirm('Gerçekten EMİN MİSİNİZ? Bütün ürün veritabanı silinecek!')
        if (!confirm2) return

        try {
            setLoading(true)
            const res = await fetch('/api/admin/products/bulk', { method: 'DELETE' })
            if (!res.ok) throw new Error('Silme işlemi başarısız')

            setProducts([])
            toast.success('Tüm ürünler başarıyla silindi.')
        } catch (error) {
            console.error(error)
            toast.error('Bir hata oluştu.')
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result
                const wb = XLSX.read(bstr, { type: 'binary' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const data = XLSX.utils.sheet_to_json(ws)

                // Transform data
                const formattedProducts = data.map((item: any) => {
                    // Build rich description with proper HTML (class not className!)
                    let descParts: string[] = []

                    // Short description at top
                    if (item['Kısa Açıklama']) {
                        descParts.push(`<p class="mb-4 text-slate-700">${item['Kısa Açıklama']}</p>`)
                    }

                    // Long description
                    if (item['Uzun Detay (Metin)']) {
                        descParts.push(`<div class="mb-4">${item['Uzun Detay (Metin)']}</div>`)
                    }

                    // Specs table with proper class attributes
                    let tableRows: string[] = []
                    if (item['Marka']) tableRows.push(`<tr><td class="p-2 border border-gray-200 font-semibold bg-slate-50">Marka</td><td class="p-2 border border-gray-200">${item['Marka']}</td></tr>`)
                    if (item['Ürün Kodu']) tableRows.push(`<tr><td class="p-2 border border-gray-200 font-semibold bg-slate-50">Ürün Kodu</td><td class="p-2 border border-gray-200">${item['Ürün Kodu']}</td></tr>`)
                    if (item['Barkod']) tableRows.push(`<tr><td class="p-2 border border-gray-200 font-semibold bg-slate-50">Barkod</td><td class="p-2 border border-gray-200">${item['Barkod']}</td></tr>`)
                    if (item['Desi']) tableRows.push(`<tr><td class="p-2 border border-gray-200 font-semibold bg-slate-50">Desi</td><td class="p-2 border border-gray-200">${item['Desi']}</td></tr>`)
                    if (item['Varyant Bilgisi']) tableRows.push(`<tr><td class="p-2 border border-gray-200 font-semibold bg-slate-50">Varyant</td><td class="p-2 border border-gray-200">${item['Varyant Bilgisi']}</td></tr>`)

                    if (tableRows.length > 0) {
                        descParts.push(`<table class="w-full border-collapse border border-gray-200 mt-4"><tbody>${tableRows.join('')}</tbody></table>`)
                    }

                    const description = descParts.length > 0 ? `<div class="product-specs">${descParts.join('')}</div>` : ''

                    // Parse stock - check multiple column names
                    const stockValue = item['Stok Adedi'] ?? item['Stok'] ?? 100
                    const parsedStock = parseInt(String(stockValue)) || 100

                    return {
                        name: item['Ürün Adı'] || item['Name'],
                        product_code: item['Ürün Kodu'] || item['Code'] || '',
                        category: item['Kategori'] || 'Genel',
                        price: parseFloat(String(item['Satış Fiyatı'] || item['Price'] || 0).replace(',', '.')),
                        original_price: parseFloat(String(item['Liste Fiyatı'] || 0).replace(',', '.')),
                        stock: parsedStock,
                        description: description,
                        images: [
                            item['Resim 1'],
                            item['Resim 2'],
                            item['Resim 3'],
                            item['Resim 4']
                        ].filter(url => url && typeof url === 'string' && url.length > 10)
                    }
                }).filter(p => p.name && !isNaN(p.price) && p.price > 0)

                if (formattedProducts.length === 0) {
                    toast.error('Dosyada geçerli ürün bulunamadı. Kolon isimlerini kontrol edin.')
                    return
                }

                // Send to API
                setLoading(true)
                const res = await fetch('/api/admin/products/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ products: formattedProducts })
                })

                const result = await res.json()
                if (result.success) {
                    toast.success(`${result.imported} ürün başarıyla yüklendi.`)
                    // Refresh list
                    window.location.reload()
                } else {
                    toast.error(`Hata: ${result.error}`)
                }

            } catch (error) {
                console.error('Excel parse error:', error)
                toast.error('Excel dosyası okunamadı.')
            } finally {
                setLoading(false)
                // Reset input
                e.target.value = ''
            }
        }
        reader.readAsBinaryString(file)
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Ürünler</h1>
                <div className="flex gap-2">
                    <Button
                        onClick={handleBulkDelete}
                        variant="destructive"
                        disabled={products.length === 0}
                        className="gap-2"
                    >
                        <Trash className="w-4 h-4" /> Tümünü Sil
                    </Button>

                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                            <Upload className="w-4 h-4" /> Excel ile Yükle
                        </Button>
                    </div>

                    <Button
                        onClick={() => router.push('/admin/products/new')}
                        className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
                    >
                        <Plus className="w-4 h-4" /> Yeni Ürün
                    </Button>
                </div>
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
