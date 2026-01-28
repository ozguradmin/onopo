'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Loader2, X, Plus } from 'lucide-react'

export default function AddProductPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)
    const [categories, setCategories] = React.useState<{ id: number, name: string, slug: string }[]>([])
    const [newCategory, setNewCategory] = React.useState('')

    const [formData, setFormData] = React.useState({
        name: '',
        description: '',
        price: '',
        original_price: '',
        stock: '10',
        category: '',
        images: [] as string[],
        warranty_info: '',
        delivery_info: '',
        installment_info: ''
    })

    // Fetch categories
    React.useEffect(() => {
        fetch('/api/categories')
            .then(r => r.json())
            .then(cats => setCategories(cats || []))
            .catch(() => { })
    }, [])

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
        setLoading(true)

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    price: parseFloat(formData.price),
                    original_price: formData.original_price ? parseFloat(formData.original_price) : null,
                    stock: parseInt(formData.stock)
                })
            })

            if (!res.ok) throw new Error('Failed to create product')
            router.push('/admin')
        } catch (error) {
            alert('Ürün oluşturma hatası')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold">Yeni Ürün Ekle</h1>
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

                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Fiyat (₺)</label>
                        <input
                            name="price"
                            type="number"
                            step="0.01"
                            value={formData.price}
                            onChange={handleInputChange}
                            className="w-full p-2 border rounded-lg"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Eski Fiyat</label>
                        <input
                            name="original_price"
                            type="number"
                            step="0.01"
                            value={formData.original_price}
                            onChange={handleInputChange}
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

                {/* Images */}
                <div>
                    <label className="block text-sm font-medium mb-1">Görseller (Birden fazla seçilebilir)</label>
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

                <div className="pt-4 border-t">
                    <Button
                        type="submit"
                        disabled={loading || uploading}
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-lg"
                    >
                        {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        Ürünü Oluştur
                    </Button>
                </div>
            </form>
        </div>
    )
}
