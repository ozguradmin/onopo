'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Upload, Loader2 } from 'lucide-react'

export default function AddProductPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)

    // Form State
    const [formData, setFormData] = React.useState({
        name: '',
        slug: '',
        description: '',
        price: '',
        stock: '10',
        image: '' // URL
    })

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))

        // Auto-slug
        if (name === 'name') {
            setFormData(prev => ({ ...prev, slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') }))
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const data = new FormData()
            data.append('file', file)

            const res = await fetch('/api/admin/upload', {
                method: 'POST',
                body: data
            })

            if (!res.ok) throw new Error('Upload failed')

            const result = await res.json()
            setFormData(prev => ({ ...prev, image: result.url }))

        } catch (error) {
            alert('Upload error')
            console.error(error)
        } finally {
            setUploading(false)
        }
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
                    stock: parseInt(formData.stock),
                    images: formData.image ? [formData.image] : [],
                    category: 'All' // Simplified
                })
            })

            if (!res.ok) throw new Error('Failed to create product')

            router.push('/admin')

        } catch (error) {
            alert('Error creating product')
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
                    <label className="block text-sm font-medium mb-1">Slug (URL)</label>
                    <input
                        name="slug"
                        value={formData.slug}
                        onChange={handleInputChange}
                        className="w-full p-2 border rounded-lg bg-slate-50"
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

                <div className="grid grid-cols-2 gap-4">
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

                <div>
                    <label className="block text-sm font-medium mb-1">Görsel</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
                        {formData.image ? (
                            <div className="relative inline-block">
                                <img src={formData.image} className="h-40 rounded-lg object-contain" />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="absolute -top-2 -right-2 rounded-full w-6 h-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => setFormData(prev => ({ ...prev, image: '' }))}
                                >
                                    &times;
                                </Button>
                            </div>
                        ) : (
                            <div>
                                <Upload className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                                <label className="block">
                                    <span className="bg-slate-900 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-slate-800 text-sm">
                                        {uploading ? 'Yükleniyor...' : 'Dosya Seç'}
                                    </span>
                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                </label>
                            </div>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t">
                    <Button type="submit" disabled={loading || uploading} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-lg">
                        {loading && <Loader2 className="w-5 h-5 mr-2 animate-spin" />}
                        Ürünü Oluştur
                    </Button>
                </div>
            </form>
        </div>
    )
}
