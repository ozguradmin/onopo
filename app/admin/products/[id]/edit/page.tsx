'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Loader2, X, Plus, ArrowRight } from 'lucide-react'
import { CurrencyInput } from '@/components/ui/currency-input'

export default function EditProductPage() {
    const router = useRouter()
    const params = useParams()
    const productId = params.id as string

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [deleting, setDeleting] = React.useState(false)
    const [categories, setCategories] = React.useState<{ id: number, name: string, slug: string }[]>([])
    const [newCategory, setNewCategory] = React.useState('')

    const [formData, setFormData] = React.useState({
        name: '',
        description: '',
        price: '',
        original_price: '',
        price_usd: '',
        stock: '10',
        category: '',
        images: [] as string[],
        warranty_info: '',
        delivery_info: '',
        installment_info: '',
        is_active: true,
        product_code: '',
        whatsapp_order_enabled: false,
        whatsapp_number: '',
        free_shipping: false
    })

    const [exchangeRate, setExchangeRate] = React.useState<number>(0)

    // Fetch product and categories
    React.useEffect(() => {
        Promise.all([
            fetch(`/api/products/${productId}`).then(r => r.json()),
            fetch('/api/categories').then(r => r.json()),
            fetch('https://api.exchangerate-api.com/v4/latest/USD').then(r => r.json()).catch(() => ({ rates: { TRY: 0 } }))
        ]).then(([product, cats, rateData]) => {
            if (product && !product.error) {
                setFormData({
                    name: product.name || '',
                    description: product.description || '',
                    price: product.price?.toString() || '',
                    original_price: product.original_price?.toString() || '',
                    price_usd: product.price_usd?.toString() || '',
                    stock: product.stock?.toString() || '10',
                    category: product.category || '',
                    images: product.images || (product.image ? [product.image] : []),
                    warranty_info: product.warranty_info || '',
                    delivery_info: product.delivery_info || '',
                    installment_info: product.installment_info || '',
                    is_active: product.is_active !== undefined ? !!product.is_active : true,
                    product_code: product.product_code || '',
                    whatsapp_order_enabled: !!product.whatsapp_order_enabled,
                    whatsapp_number: product.whatsapp_number || '',
                    free_shipping: !!product.free_shipping
                })
            }
            setCategories(cats || [])
            if (rateData?.rates?.TRY) setExchangeRate(rateData.rates.TRY)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [productId])

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files
        if (!files || files.length === 0) return

        setUploading(true)
        try {
            const uploadPromises = Array.from(files).map(async file => {
                const data = new FormData()
                data.append('file', file)
                const res = await fetch('/api/admin/upload', { method: 'POST', body: data })
                if (!res.ok) throw new Error('Upload failed')
                const result = await res.json()
                return result.url
            })

            const newUrls = await Promise.all(uploadPromises)
            setFormData(prev => ({ ...prev, images: [...prev.images, ...newUrls] }))
        } catch (error) {
            alert('Yükleme hatası')
        } finally {
            setUploading(false)
        }
    }

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }))
    }

    const handleAddCategory = async () => {
        if (!newCategory.trim()) return
        try {
            const res = await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategory })
            })
            if (res.ok) {
                const data = await res.json()
                setCategories(prev => [...prev, { id: Date.now(), name: newCategory, slug: data.slug }])
                setFormData(prev => ({ ...prev, category: newCategory }))
                setNewCategory('')
            }
        } catch { }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)

        try {
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    // Convert Turkish comma format to dot for proper parsing
                    price: parseFloat(String(formData.price).replace(',', '.')),
                    original_price: formData.original_price ? parseFloat(String(formData.original_price).replace(',', '.')) : null,
                    price_usd: formData.price_usd ? parseFloat(String(formData.price_usd).replace(',', '.')) : null,
                    stock: parseInt(formData.stock),
                    is_active: formData.is_active ? 1 : 0,
                    product_code: formData.product_code,
                    whatsapp_order_enabled: formData.whatsapp_order_enabled,
                    whatsapp_number: formData.whatsapp_number,
                    free_shipping: formData.free_shipping ? 1 : 0
                })
            })

            if (!res.ok) throw new Error('Failed to update')
            router.push('/admin')
        } catch (error) {
            alert('Güncelleme hatası')
        } finally {
            setSaving(false)
        }
    }



    const handleDelete = async () => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return

        setDeleting(true)
        try {
            const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            router.push('/admin')
        } catch {
            alert('Silme hatası')
        } finally {
            setDeleting(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold">Ürünü Düzenle</h1>
            </div>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
                <div>
                    <label className="block text-sm font-medium mb-1">Ürün Adı</label>
                    <input
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Açıklama</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg h-24"
                    />
                </div>

                {/* USD Price Section */}
                <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200 space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-medium text-emerald-900 block flex items-center gap-2">
                                <span className="text-lg">$</span>
                                Dolar Bazlı Fiyat
                            </label>
                            <p className="text-xs text-emerald-700">
                                USD fiyatı girilirse, TL fiyatı her gün saat 10:00'da güncel kurla otomatik güncellenir
                            </p>
                        </div>
                        {exchangeRate > 0 && (
                            <div className="text-right">
                                <p className="text-xs text-emerald-600">Güncel Kur</p>
                                <p className="text-sm font-bold text-emerald-900">1$ = ₺{exchangeRate.toFixed(2)}</p>
                            </div>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1 text-emerald-800">USD Fiyat</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-emerald-600 font-bold">$</span>
                                <CurrencyInput
                                    name="price_usd"
                                    value={formData.price_usd}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, price_usd: val }))
                                        // Auto-calculate TL price if exchange rate available
                                        if (val && exchangeRate > 0) {
                                            const usdValue = parseFloat(val.replace(',', '.')) || 0
                                            const tlValue = (usdValue * exchangeRate).toFixed(2)
                                            setFormData(prev => ({ ...prev, price_usd: val, price: tlValue.replace('.', ',') }))
                                        }
                                    }}
                                    className="w-full pl-8 p-2 border border-emerald-300 rounded-lg bg-white focus:ring-emerald-500"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>
                        {formData.price_usd && exchangeRate > 0 && (
                            <div>
                                <label className="block text-sm font-medium mb-1 text-emerald-800">Hesaplanan TL</label>
                                <div className="p-2 bg-emerald-100 rounded-lg text-emerald-900 font-bold">
                                    ₺{((parseFloat(formData.price_usd.replace(',', '.')) || 0) * exchangeRate).toFixed(2)}
                                </div>
                                <p className="text-xs text-emerald-600 mt-1">Otomatik güncellenecek</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Fiyat (₺) {formData.price_usd && <span className="text-xs text-emerald-600">(USD'den)</span>}</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500">₺</span>
                            <CurrencyInput
                                name="price"
                                value={formData.price}
                                onChange={(val) => setFormData(prev => ({ ...prev, price: val }))}
                                className={`w-full pl-12 p-2 border rounded-lg ${formData.price_usd ? 'bg-slate-50' : ''}`}
                                placeholder="0,00"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Eski Fiyat</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500">₺</span>
                            <CurrencyInput
                                name="original_price"
                                value={formData.original_price}
                                onChange={(val) => setFormData(prev => ({ ...prev, original_price: val }))}
                                className="w-full pl-12 p-2 border rounded-lg"
                                placeholder="Opsiyonel"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Stok</label>
                        <input
                            name="stock"
                            type="number"
                            value={formData.stock}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>
                </div>

                {/* Category */}
                <div>
                    <label className="block text-sm font-medium mb-1">Kategori</label>
                    <div className="flex gap-2">
                        <select
                            name="category"
                            value={formData.category}
                            onChange={handleInputChange}
                            className="flex-1 p-2 border rounded-lg"
                        >
                            <option value="">Kategori Seçin</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>{cat.name}</option>
                            ))}
                        </select>
                        <div className="flex gap-1">
                            <input
                                type="text"
                                value={newCategory}
                                onChange={e => setNewCategory(e.target.value)}
                                placeholder="Yeni kategori"
                                className="w-32 p-2 border rounded-lg text-sm"
                            />
                            <Button type="button" variant="outline" onClick={handleAddCategory}>
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Ürün Kodu</label>
                        <input
                            name="product_code"
                            value={formData.product_code || ''}
                            onChange={handleInputChange}
                            placeholder="Örn: KOD-123"
                            className="w-full p-2 border rounded-lg"
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                        <label className="text-sm font-medium text-slate-900 block">Ürün Görünürlüğü</label>
                        <p className="text-xs text-slate-500">Bu ürünü mağazada yayınla veya gizle</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.is_active}
                            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
                        <span className="ml-3 text-sm font-medium text-slate-700">{formData.is_active ? 'Yayında' : 'Gizli'}</span>
                    </label>
                </div>

                <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <div>
                        <label className="text-sm font-medium text-blue-900 block">Ücretsiz Kargo</label>
                        <p className="text-xs text-blue-700">Bu ürün için kargo ücreti alınmasın</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={formData.free_shipping}
                            onChange={(e) => setFormData(prev => ({ ...prev, free_shipping: e.target.checked }))}
                        />
                        <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        <span className="ml-3 text-sm font-medium text-blue-700">{formData.free_shipping ? 'Evet' : 'Hayır'}</span>
                    </label>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="text-sm font-medium text-green-900 block flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" /></svg>
                                WhatsApp İle Sipariş
                            </label>
                            <p className="text-xs text-green-700">Ürün sayfasında WhatsApp butonu göster</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={formData.whatsapp_order_enabled}
                                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_order_enabled: e.target.checked }))}
                            />
                            <div className="w-11 h-6 bg-green-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    {formData.whatsapp_order_enabled && (
                        <div>
                            <label className="block text-sm font-medium mb-1">WhatsApp Numarası</label>
                            <input
                                name="whatsapp_number"
                                value={formData.whatsapp_number || ''}
                                onChange={handleInputChange}
                                placeholder="Örn: 905551234567"
                                className="w-full p-2 border rounded-lg"
                            />
                            <p className="text-xs text-slate-500 mt-1">Başında 90 olan formatta giriniz.</p>
                        </div>
                    )}
                </div>

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium mb-1">Görseller</label>
                    <div className="flex flex-wrap gap-3 mb-3">
                        {formData.images.map((img, idx) => (
                            <div key={idx} className="relative group">
                                <img src={img} className="w-24 h-24 object-contain rounded-lg border bg-slate-50" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                                    {idx > 0 && (
                                        <button type="button" onClick={() => {
                                            const newImages = [...formData.images];
                                            [newImages[idx - 1], newImages[idx]] = [newImages[idx], newImages[idx - 1]];
                                            setFormData(prev => ({ ...prev, images: newImages }));
                                        }} className="p-1 bg-white rounded-full text-slate-700 hover:bg-slate-100">
                                            <ArrowLeft className="w-3 h-3" />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeImage(idx)}
                                        className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                    {idx < formData.images.length - 1 && (
                                        <button type="button" onClick={() => {
                                            const newImages = [...formData.images];
                                            [newImages[idx], newImages[idx + 1]] = [newImages[idx + 1], newImages[idx]];
                                            setFormData(prev => ({ ...prev, images: newImages }));
                                        }} className="p-1 bg-white rounded-full text-slate-700 hover:bg-slate-100">
                                            <ArrowRight className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                                {idx === 0 && <div className="absolute top-0 left-0 bg-yellow-400 text-black text-[10px] px-1 rounded-br font-bold">Kapak</div>}
                            </div>
                        ))}
                    </div>
                    <label className="inline-block">
                        <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-200 text-sm flex items-center gap-2">
                            <Upload className="w-4 h-4" />
                            {uploading ? 'Yükleniyor...' : 'Görsel Ekle'}
                        </span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
                    </label>
                </div>

                {/* Extra Info Fields */}
                <div>
                    <label className="block text-sm font-medium mb-1">Garanti Bilgisi</label>
                    <textarea
                        name="warranty_info"
                        value={formData.warranty_info}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg h-20"
                        placeholder="Örn: 2 yıl resmi distribütör garantisi"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Teslimat Bilgisi</label>
                    <textarea
                        name="delivery_info"
                        value={formData.delivery_info}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg h-20"
                        placeholder="Örn: 1-3 iş günü içinde kargoya verilir"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">Taksit Seçenekleri</label>
                    <textarea
                        name="installment_info"
                        value={formData.installment_info}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg h-20"
                        placeholder="Örn: Kredi kartına 9 taksit imkanı"
                    />
                </div>

                <div className="pt-4 border-t flex gap-3">
                    <Button
                        type="submit"
                        disabled={saving || uploading}
                        className="flex-1 bg-slate-900 text-white hover:bg-slate-800 h-12"
                    >
                        {saving && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        Değişiklikleri Kaydet
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="h-12 border-red-500 text-red-500 hover:bg-red-50"
                    >
                        {deleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Sil'}
                    </Button>
                </div>
            </form>
        </div>
    )
}
