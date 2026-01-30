'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Plus, Upload, Trash, Loader2, Search } from 'lucide-react'
import { formatPrice } from '@/lib/formatPrice'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

export default function AdminProductsPage() {
    const router = useRouter()
    const [products, setProducts] = React.useState<any[]>([])
    const [categories, setCategories] = React.useState<{ id: number, name: string }[]>([])
    const [loading, setLoading] = React.useState(true)

    // Search and Filter state
    const [searchQuery, setSearchQuery] = React.useState('')
    const [selectedCategory, setSelectedCategory] = React.useState('')

    React.useEffect(() => {
        Promise.all([
            fetch('/api/products').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]).then(([prods, cats]) => {
            setProducts(prods || [])
            setCategories(cats || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    // Filtered products
    const filteredProducts = React.useMemo(() => {
        return products.filter(p => {
            const matchesSearch = searchQuery === '' ||
                p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.product_code?.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory = selectedCategory === '' ||
                p.category?.toLowerCase() === selectedCategory.toLowerCase()
            return matchesSearch && matchesCategory
        })
    }, [products, searchQuery, selectedCategory])

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
                    // Build rich description with proper HTML formatting
                    let descParts: string[] = []

                    // Product title and short description
                    const productName = item['Ürün Adı'] || item['Name'] || ''

                    // Short description at top with proper formatting
                    if (item['Kısa Açıklama']) {
                        descParts.push(`<h3 class="text-lg font-semibold text-slate-900 mb-3">Ürün Açıklaması</h3>`)
                        descParts.push(`<p class="mb-4 text-slate-700 leading-relaxed">${item['Kısa Açıklama']}</p>`)
                    }

                    // Long description with better formatting
                    if (item['Uzun Detay (Metin)']) {
                        const longDesc = String(item['Uzun Detay (Metin)'])
                        // Split by sentences and format as list items if multiple sentences
                        const sentences = longDesc.split(/[.]\s+/).filter(s => s.trim().length > 10)
                        if (sentences.length > 2) {
                            descParts.push(`<h3 class="text-lg font-semibold text-slate-900 mb-3 mt-4">Detaylı Bilgi</h3>`)
                            descParts.push(`<ul class="list-disc list-inside space-y-2 text-slate-700 mb-4">`)
                            sentences.forEach(s => {
                                if (s.trim()) descParts.push(`<li>${s.trim()}.</li>`)
                            })
                            descParts.push(`</ul>`)
                        } else {
                            descParts.push(`<h3 class="text-lg font-semibold text-slate-900 mb-3 mt-4">Detaylı Bilgi</h3>`)
                            descParts.push(`<p class="mb-4 text-slate-700 leading-relaxed">${longDesc}</p>`)
                        }
                    }

                    // Specs table with proper formatting
                    let tableRows: string[] = []
                    if (item['Marka']) tableRows.push(`<tr><td class="p-3 border border-gray-200 font-semibold bg-slate-50 w-1/3">Marka</td><td class="p-3 border border-gray-200">${item['Marka']}</td></tr>`)
                    if (item['Ürün Kodu']) tableRows.push(`<tr><td class="p-3 border border-gray-200 font-semibold bg-slate-50">Ürün Kodu</td><td class="p-3 border border-gray-200">${item['Ürün Kodu']}</td></tr>`)
                    if (item['Barkod']) tableRows.push(`<tr><td class="p-3 border border-gray-200 font-semibold bg-slate-50">Barkod</td><td class="p-3 border border-gray-200">${item['Barkod']}</td></tr>`)
                    if (item['Desi']) tableRows.push(`<tr><td class="p-3 border border-gray-200 font-semibold bg-slate-50">Desi</td><td class="p-3 border border-gray-200">${item['Desi']}</td></tr>`)
                    if (item['Varyant Bilgisi']) tableRows.push(`<tr><td class="p-3 border border-gray-200 font-semibold bg-slate-50">Varyant</td><td class="p-3 border border-gray-200">${item['Varyant Bilgisi']}</td></tr>`)

                    if (tableRows.length > 0) {
                        descParts.push(`<h3 class="text-lg font-semibold text-slate-900 mb-3 mt-6">Teknik Özellikler</h3>`)
                        descParts.push(`<table class="w-full border-collapse border border-gray-200 rounded-lg overflow-hidden"><tbody>${tableRows.join('')}</tbody></table>`)
                    }

                    const description = descParts.length > 0 ? `<div class="product-description space-y-4">${descParts.join('')}</div>` : ''

                    // Parse stock - check multiple column names
                    const stockValue = item['Stok Adedi'] ?? item['Stok'] ?? 100
                    const parsedStock = parseInt(String(stockValue)) || 100

                    // Delivery info - standard for all bulk uploaded products
                    const deliveryInfo = `<div class="space-y-3">
                        <h4 class="font-semibold text-slate-900">TESLİMAT</h4>
                        <p class="text-slate-700">Ürünü sipariş verdiğiniz gün saat 18:00 ve öncesi ise siparişiniz aynı gün kargoya verilir ve ertesi gün teslim edilir.</p>
                        <p class="text-slate-700">Eğer kargoyu saat 18:00'den sonra verdiyseniz ürününüzün stoklarda olması durumunda ertesi gün kargolama yapılmaktadır.</p>
                    </div>`

                    return {
                        name: productName,
                        product_code: item['Ürün Kodu'] || item['Code'] || '',
                        category: item['Kategori'] || 'Genel',
                        price: parseFloat(String(item['Satış Fiyatı'] || item['Price'] || 0).replace(',', '.')),
                        original_price: parseFloat(String(item['Liste Fiyatı'] || 0).replace(',', '.')),
                        stock: parsedStock,
                        description: description,
                        delivery_info: deliveryInfo,
                        whatsapp_order_enabled: true,
                        whatsapp_number: '905058217547',
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

            {/* Search and Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Ürün adı veya kodu ile ara..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent min-w-[200px]"
                >
                    <option value="">Tüm Kategoriler</option>
                    {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                </select>
                {(searchQuery || selectedCategory) && (
                    <Button
                        variant="ghost"
                        onClick={() => { setSearchQuery(''); setSelectedCategory(''); }}
                        className="text-slate-500"
                    >
                        Temizle
                    </Button>
                )}
            </div>

            {/* Results count */}
            {(searchQuery || selectedCategory) && (
                <p className="text-sm text-slate-500 mb-2">
                    {filteredProducts.length} ürün bulundu
                </p>
            )}

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
                            {filteredProducts.map(product => (
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
                            {filteredProducts.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Henüz ürün yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
