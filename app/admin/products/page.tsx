'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Plus, Upload, Trash, Loader2, Search } from 'lucide-react'
import { formatPrice } from '@/lib/formatPrice'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { ProductEditModal } from '@/components/admin/ProductEditModal'

export default function AdminProductsPage() {
    const router = useRouter()
    const searchParams = useSearchParams()

    const [products, setProducts] = React.useState<any[]>([])
    const [categories, setCategories] = React.useState<{ id: number, name: string }[]>([])
    const [loading, setLoading] = React.useState(true)

    // Modal state
    const [editModalOpen, setEditModalOpen] = React.useState(false)
    const [editProductId, setEditProductId] = React.useState<string | null>(null)

    // Parse URL params for initial state
    const initialPage = Number(searchParams.get('page')) || 1
    const initialSearch = searchParams.get('q') || ''
    const initialCategory = searchParams.get('cat') || ''
    const initialPageSize = Number(searchParams.get('size')) || 10

    // Local state (synced with URL via effects/actions)
    const [searchQuery, setSearchQuery] = React.useState(initialSearch)
    const [selectedCategory, setSelectedCategory] = React.useState(initialCategory)
    const [currentPage, setCurrentPage] = React.useState(initialPage)
    const [pageSize, setPageSize] = React.useState(initialPageSize)

    // Update URL helper
    const updateUrl = (updates: any) => {
        const params = new URLSearchParams(searchParams.toString())
        if (updates.page) params.set('page', updates.page.toString())
        if (updates.q !== undefined) {
            if (updates.q) params.set('q', updates.q)
            else params.delete('q')
        }
        if (updates.cat !== undefined) {
            if (updates.cat) params.set('cat', updates.cat)
            else params.delete('cat')
        }
        if (updates.size) params.set('size', updates.size.toString())

        router.replace(`/admin/products?${params.toString()}`, { scroll: false })
    }

    const fetchProducts = React.useCallback(() => {
        Promise.all([
            fetch('/api/products?includeAll=true').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]).then(([prods, cats]) => {
            setProducts(prods || [])
            setCategories(cats || [])
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    React.useEffect(() => {
        fetchProducts()
    }, [fetchProducts])

    // Sync state changes to URL
    const handleSearchChange = (val: string) => {
        setSearchQuery(val)
        setCurrentPage(1)
        updateUrl({ q: val, page: 1 })
    }

    const handleCategoryChange = (val: string) => {
        setSelectedCategory(val)
        setCurrentPage(1)
        updateUrl({ cat: val, page: 1 })
    }

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
        updateUrl({ page: newPage })
    }

    const handlePageSizeChange = (newSize: number) => {
        setPageSize(newSize)
        setCurrentPage(1)
        updateUrl({ size: newSize, page: 1 })
    }

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

    // Paginated products
    const paginatedProducts = React.useMemo(() => {
        if (pageSize === 0) return filteredProducts // 0 means "all"
        const start = (currentPage - 1) * pageSize
        return filteredProducts.slice(start, start + pageSize)
    }, [filteredProducts, currentPage, pageSize])

    const totalPages = pageSize === 0 ? 1 : Math.ceil(filteredProducts.length / pageSize)

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

                // Transform data - support multiple column naming conventions
                const formattedProducts = data.map((item: any) => {
                    // Get product name - try multiple column names
                    const productName = item['Ürün Adı'] || item['Name'] || item['name'] || ''

                    // Get price - support multiple formats: "Fiyat (₺)", "Satış Fiyatı", "Price"
                    const priceRaw = item['Fiyat (₺)'] || item['Satış Fiyatı'] || item['Price'] || item['price'] || 0
                    const price = parseFloat(String(priceRaw).replace(/[^\d.,]/g, '').replace(',', '.')) || 0

                    // Get original price
                    const origPriceRaw = item['Eski Fiyat (₺)'] || item['Liste Fiyatı'] || item['original_price'] || 0
                    const originalPrice = parseFloat(String(origPriceRaw).replace(/[^\d.,]/g, '').replace(',', '.')) || 0

                    // Get stock
                    const stockRaw = item['Stok'] || item['Stok Adedi'] || item['stock'] || 100
                    const stock = parseInt(String(stockRaw)) || 100

                    // Get category
                    const category = item['Kategori'] || item['Category'] || item['category'] || 'Genel'

                    // Get product code
                    const productCode = item['Ürün Kodu'] || item['Code'] || item['product_code'] || ''

                    // Get description - support multiple column names
                    let description = item['Açıklama'] || item['Detay'] || item['Description'] || ''

                    // If description has "Ürün Açıklaması" text, format it nicely
                    if (description && description.includes('Ürün Açıklaması')) {
                        description = `<div class="product-description space-y-4">${description}</div>`
                    }

                    // Get image URL - support multiple column names
                    const imageUrl = item['Görsel URL'] || item['Resim 1'] || item['Resim'] || item['Image'] || item['image'] || ''

                    // Also check for multiple images
                    const images: string[] = []
                    if (imageUrl) images.push(imageUrl)
                    if (item['Resim 2']) images.push(item['Resim 2'])
                    if (item['Resim 3']) images.push(item['Resim 3'])
                    if (item['Resim 4']) images.push(item['Resim 4'])

                    // Delivery info - standard for all bulk uploaded products
                    const deliveryInfo = `<div class="space-y-3">
                        <h4 class="font-semibold text-slate-900">TESLİMAT</h4>
                        <p class="text-slate-700">Ürünü sipariş verdiğiniz gün saat 18:00 ve öncesi ise siparişiniz aynı gün kargoya verilir ve ertesi gün teslim edilir.</p>
                    </div>`

                    return {
                        name: productName,
                        product_code: productCode,
                        category: category,
                        price: price,
                        original_price: originalPrice || null,
                        stock: stock,
                        description: description,
                        delivery_info: deliveryInfo,
                        whatsapp_order_enabled: true,
                        whatsapp_number: '905058217547',
                        images: images.filter(url => url && typeof url === 'string' && url.length > 10)
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

    // Prepare query string for edit page return
    const getReturnQuery = () => {
        const params = new URLSearchParams()
        if (currentPage > 1) params.set('returnPage', currentPage.toString())
        if (searchQuery) params.set('returnQ', searchQuery)
        if (selectedCategory) params.set('returnCat', selectedCategory)
        if (pageSize !== 10) params.set('returnSize', pageSize.toString())
        return params.toString()
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Ürünler</h1>
                <div className="flex gap-2">
                    <Button
                        onClick={handleBulkDelete}
                        variant="outline"
                        disabled={products.length === 0}
                        className="gap-2 border-red-500 text-red-500 hover:bg-red-50"
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
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                    />
                </div>
                <select
                    value={selectedCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
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
                        onClick={() => { setSearchQuery(''); setSelectedCategory(''); updateUrl({ q: '', cat: '', page: 1 }); }}
                        className="text-slate-500"
                    >
                        Temizle
                    </Button>
                )}
                <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                    <option value={10}>10 / sayfa</option>
                    <option value={20}>20 / sayfa</option>
                    <option value={40}>40 / sayfa</option>
                    <option value={80}>80 / sayfa</option>
                    <option value={0}>Tümü</option>
                </select>
            </div>

            {/* Results count */}
            <p className="text-sm text-slate-500 mb-2">
                {filteredProducts.length} ürün bulundu
                {pageSize > 0 && ` (Sayfa ${currentPage}/${totalPages})`}
            </p>

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
                            {paginatedProducts.map(product => (
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
                                            onClick={() => {
                                                setEditProductId(String(product.id))
                                                setEditModalOpen(true)
                                            }}
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
                            {paginatedProducts.length === 0 && (
                                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Henüz ürün yok.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Button
                        variant="outline"
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
                                    onClick={() => handlePageChange(page)}
                                    className="w-10"
                                >
                                    {page}
                                </Button>
                            )
                        })}
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                    >
                        Sonraki
                    </Button>
                </div>
            )}

            {/* Edit Product Modal */}
            <ProductEditModal
                isOpen={editModalOpen}
                onClose={() => {
                    setEditModalOpen(false)
                    setEditProductId(null)
                }}
                productId={editProductId}
                onSuccess={() => {
                    fetchProducts()
                    toast.success('Ürün güncellendi')
                }}
            />
        </div>
    )
}
