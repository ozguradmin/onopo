'use client'

import * as React from 'react'
import { X, Upload, Loader2, ArrowLeft, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { VariationsSection, Variation } from './VariationsSection'

interface ProductEditModalProps {
    isOpen: boolean
    onClose: () => void
    productId: string | null
    onSuccess: () => void
}

export function ProductEditModal({ isOpen, onClose, productId, onSuccess }: ProductEditModalProps) {
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [deleting, setDeleting] = React.useState(false)
    const [categories, setCategories] = React.useState<{ id: number, name: string }[]>([])
    const [newCategory, setNewCategory] = React.useState('')
    const [variations, setVariations] = React.useState<Variation[]>([])

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

    // Fetch product and categories when modal opens
    React.useEffect(() => {
        if (!isOpen || !productId) return

        setLoading(true)
        Promise.all([
            fetch(`/api/products/${productId}`).then(r => r.json()),
            fetch('/api/categories').then(r => r.json()),
            fetch(`/api/products/${productId}/variations`).then(r => r.json()),
            fetch('https://api.exchangerate-api.com/v4/latest/USD').then(r => r.json()).catch(() => ({ rates: { TRY: 0 } }))
        ]).then(([product, cats, vars, rateData]) => {
            if (product && !product.error) {
                setFormData({
                    name: product.name || '',
                    description: product.description || '',
                    price: product.price?.toString() || '',
                    original_price: product.original_price?.toString() || '',
                    price_usd: product.price_usd?.toString() || '',
                    stock: product.stock?.toString() || '10',
                    category: product.category || '',
                    images: product.images || [],
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
            setVariations((vars || []).map((v: any) => ({
                id: v.id,
                name: v.name || '',
                value: v.value || '',
                price_modifier: v.price_modifier?.toString() || '0',
                stock: v.stock?.toString() || '0',
                sku: v.sku || '',
                image_url: v.image_url || ''
            })))
            if (rateData?.rates?.TRY) setExchangeRate(rateData.rates.TRY)
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [isOpen, productId])

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
        } catch {
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
                setCategories(prev => [...prev, { id: Date.now(), name: newCategory }])
                setFormData(prev => ({ ...prev, category: newCategory }))
                setNewCategory('')
            }
        } catch { }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!productId) return

        setSaving(true)
        try {
            // Save product
            const res = await fetch(`/api/products/${productId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    price: parseFloat(String(formData.price).replace(',', '.')),
                    original_price: formData.original_price ? parseFloat(String(formData.original_price).replace(',', '.')) : null,
                    price_usd: formData.price_usd ? parseFloat(String(formData.price_usd).replace(',', '.')) : null,
                    stock: parseInt(formData.stock),
                    is_active: formData.is_active ? 1 : 0,
                    free_shipping: formData.free_shipping ? 1 : 0
                })
            })

            if (!res.ok) throw new Error('Failed to update')

            // Save variations
            await fetch(`/api/products/${productId}/variations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    variations: variations.map(v => ({
                        name: v.name,
                        value: v.value,
                        price_modifier: parseFloat(String(v.price_modifier).replace(',', '.')) || 0,
                        stock: parseInt(v.stock) || 0,
                        sku: v.sku,
                        image_url: v.image_url
                    }))
                })
            })

            onSuccess()
            onClose()
        } catch {
            alert('Güncelleme hatası')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Bu ürünü silmek istediğinize emin misiniz?')) return
        if (!productId) return

        setDeleting(true)
        try {
            const res = await fetch(`/api/products/${productId}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Failed to delete')
            onSuccess()
            onClose()
        } catch {
            alert('Silme hatası')
        } finally {
            setDeleting(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 relative">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b px-6 py-4 rounded-t-xl flex items-center justify-between z-10">
                    <h2 className="text-xl font-bold">Ürünü Düzenle</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                        {/* Name */}
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

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Açıklama</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-lg h-20"
                            />
                        </div>

                        {/* USD Price */}
                        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-200">
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-sm font-medium text-emerald-900">Dolar Bazlı Fiyat</label>
                                {exchangeRate > 0 && (
                                    <span className="text-xs text-emerald-600">1$ = ₺{exchangeRate.toFixed(2)}</span>
                                )}
                            </div>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-emerald-600 font-bold">$</span>
                                <CurrencyInput
                                    name="price_usd"
                                    value={formData.price_usd}
                                    onChange={(val) => {
                                        setFormData(prev => ({ ...prev, price_usd: val }))
                                        if (val && exchangeRate > 0) {
                                            const usdValue = parseFloat(val.replace(',', '.')) || 0
                                            const tlValue = (usdValue * exchangeRate).toFixed(2)
                                            setFormData(prev => ({ ...prev, price_usd: val, price: tlValue.replace('.', ',') }))
                                        }
                                    }}
                                    className="w-full pl-8 p-2 border border-emerald-300 rounded-lg"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Prices and Stock */}
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Fiyat (₺)</label>
                                <CurrencyInput
                                    name="price"
                                    value={formData.price}
                                    onChange={(val) => setFormData(prev => ({ ...prev, price: val }))}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Eski Fiyat</label>
                                <CurrencyInput
                                    name="original_price"
                                    value={formData.original_price}
                                    onChange={(val) => setFormData(prev => ({ ...prev, original_price: val }))}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="Opsiyonel"
                                />
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
                                <input
                                    type="text"
                                    value={newCategory}
                                    onChange={e => setNewCategory(e.target.value)}
                                    placeholder="Yeni"
                                    className="w-24 p-2 border rounded-lg text-sm"
                                />
                                <Button type="button" variant="outline" onClick={handleAddCategory} size="sm">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Product Code */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Ürün Kodu</label>
                            <input
                                name="product_code"
                                value={formData.product_code}
                                onChange={handleInputChange}
                                placeholder="Örn: KOD-123"
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>

                        {/* Toggles Row */}
                        <div className="grid grid-cols-3 gap-3">
                            <label className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.is_active}
                                    onChange={e => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">Yayında</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.free_shipping}
                                    onChange={e => setFormData(prev => ({ ...prev, free_shipping: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">Ücretsiz Kargo</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 bg-green-50 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.whatsapp_order_enabled}
                                    onChange={e => setFormData(prev => ({ ...prev, whatsapp_order_enabled: e.target.checked }))}
                                    className="w-4 h-4"
                                />
                                <span className="text-sm">WhatsApp</span>
                            </label>
                        </div>

                        {formData.whatsapp_order_enabled && (
                            <input
                                name="whatsapp_number"
                                value={formData.whatsapp_number}
                                onChange={handleInputChange}
                                placeholder="WhatsApp: 905551234567"
                                className="w-full p-2 border rounded-lg"
                            />
                        )}

                        {/* Variations */}
                        <VariationsSection
                            variations={variations}
                            onChange={setVariations}
                        />

                        {/* Images */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Görseller</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {formData.images.map((img, idx) => (
                                    <div key={idx} className="relative group">
                                        <img src={img} className="w-16 h-16 object-contain rounded border bg-slate-50" />
                                        <button
                                            type="button"
                                            onClick={() => removeImage(idx)}
                                            className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100"
                                        >
                                            ×
                                        </button>
                                        {idx === 0 && <div className="absolute bottom-0 left-0 bg-yellow-400 text-[8px] px-1 font-bold">Kapak</div>}
                                    </div>
                                ))}
                            </div>
                            <label className="inline-block">
                                <span className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded cursor-pointer hover:bg-slate-200 text-sm flex items-center gap-1">
                                    <Upload className="w-3 h-3" />
                                    {uploading ? 'Yükleniyor...' : 'Ekle'}
                                </span>
                                <input type="file" className="hidden" accept="image/*" multiple onChange={handleImageUpload} disabled={uploading} />
                            </label>
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t flex gap-3">
                            <Button
                                type="submit"
                                disabled={saving || uploading}
                                className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                            >
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Kaydet
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="border-red-500 text-red-500 hover:bg-red-50"
                            >
                                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Sil'}
                            </Button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
