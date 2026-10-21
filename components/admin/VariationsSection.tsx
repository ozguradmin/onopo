'use client'

import * as React from 'react'
import { Plus, X, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CurrencyInput } from '@/components/ui/currency-input'
import { uploadImageVariants } from '@/lib/imageVariants'

export interface Variation {
    id?: number
    name: string
    value: string
    price_modifier: string
    stock: string
    sku: string
    image_url: string
}

interface VariationsSectionProps {
    variations: Variation[]
    onChange: (variations: Variation[]) => void
}

const VARIATION_TYPES = [
    { name: 'Renk', examples: ['Siyah', 'Beyaz', 'Kırmızı', 'Mavi'] },
    { name: 'Beden', examples: ['XS', 'S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Kapasite', examples: ['64GB', '128GB', '256GB', '512GB'] },
    { name: 'Boyut', examples: ['Küçük', 'Orta', 'Büyük'] },
]

export function VariationsSection({ variations, onChange }: VariationsSectionProps) {
    const [selectedType, setSelectedType] = React.useState('')
    const [customType, setCustomType] = React.useState('')
    const [uploadingIndex, setUploadingIndex] = React.useState<number | null>(null)

    const addVariation = () => {
        const typeName = selectedType === 'Özel' ? customType : selectedType
        if (!typeName) return

        onChange([
            ...variations,
            {
                name: typeName,
                value: '',
                price_modifier: '0',
                stock: '0',
                sku: '',
                image_url: ''
            }
        ])
    }

    const updateVariation = (index: number, field: keyof Variation, value: string) => {
        const updated = [...variations]
        updated[index] = { ...updated[index], [field]: value }
        onChange(updated)
    }

    const removeVariation = (index: number) => {
        onChange(variations.filter((_, i) => i !== index))
    }

    const handleImageUpload = async (index: number, file: File) => {
        setUploadingIndex(index)
        try {
            const formData = new FormData()
            formData.append('file', file)
            const res = await fetch('/api/admin/upload', { method: 'POST', body: formData })
            if (!res.ok) throw new Error('Upload failed')
            const result = await res.json()
            void uploadImageVariants(file, result.url) // resized WebP copies; never blocks saving
            updateVariation(index, 'image_url', result.url)
        } catch (error) {
            console.error('Upload error:', error)
        } finally {
            setUploadingIndex(null)
        }
    }

    // Group variations by name for display
    const groupedVariations = variations.reduce((acc, v, idx) => {
        if (!acc[v.name]) acc[v.name] = []
        acc[v.name].push({ ...v, _index: idx })
        return acc
    }, {} as Record<string, (Variation & { _index: number })[]>)

    return (
        <div className="bg-purple-50 p-4 rounded-lg border border-purple-200 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <label className="text-sm font-medium text-purple-900 block">
                        Ürün Varyasyonları
                    </label>
                    <p className="text-xs text-purple-700">
                        Renk, beden, kapasite gibi seçenekler ekleyin
                    </p>
                </div>
            </div>

            {/* Add new variation */}
            <div className="flex gap-2 flex-wrap items-end">
                <div>
                    <label className="text-xs text-purple-700 block mb-1">Varyasyon Tipi</label>
                    <select
                        value={selectedType}
                        onChange={e => setSelectedType(e.target.value)}
                        className="p-2 border border-purple-300 rounded-lg text-sm bg-white"
                    >
                        <option value="">Seçin...</option>
                        {VARIATION_TYPES.map(t => (
                            <option key={t.name} value={t.name}>{t.name}</option>
                        ))}
                        <option value="Özel">Özel Tip...</option>
                    </select>
                </div>
                {selectedType === 'Özel' && (
                    <input
                        type="text"
                        value={customType}
                        onChange={e => setCustomType(e.target.value)}
                        placeholder="Tip adı"
                        className="p-2 border border-purple-300 rounded-lg text-sm"
                    />
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={addVariation}
                    disabled={!selectedType || (selectedType === 'Özel' && !customType)}
                    className="border-purple-400 text-purple-700 hover:bg-purple-100"
                >
                    <Plus className="w-4 h-4 mr-1" /> Ekle
                </Button>
            </div>

            {/* Display grouped variations */}
            {Object.entries(groupedVariations).map(([typeName, items]) => (
                <div key={typeName} className="bg-white rounded-lg p-3 border border-purple-100">
                    <h4 className="text-sm font-semibold text-purple-900 mb-2">{typeName}</h4>
                    <div className="space-y-2">
                        {items.map((v) => (
                            <div key={v._index} className="grid grid-cols-12 gap-2 items-center">
                                <input
                                    type="text"
                                    value={v.value}
                                    onChange={e => updateVariation(v._index, 'value', e.target.value)}
                                    placeholder="Değer (örn: Kırmızı)"
                                    className="col-span-3 p-2 border rounded text-sm"
                                />
                                <div className="col-span-2 relative">
                                    <span className="absolute left-2 top-2.5 text-xs text-slate-400">±₺</span>
                                    <CurrencyInput
                                        value={v.price_modifier}
                                        onChange={val => updateVariation(v._index, 'price_modifier', val)}
                                        className="w-full pl-8 p-2 border rounded text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                <input
                                    type="number"
                                    value={v.stock}
                                    onChange={e => updateVariation(v._index, 'stock', e.target.value)}
                                    placeholder="Stok"
                                    className="col-span-2 p-2 border rounded text-sm"
                                />
                                <input
                                    type="text"
                                    value={v.sku}
                                    onChange={e => updateVariation(v._index, 'sku', e.target.value)}
                                    placeholder="SKU"
                                    className="col-span-2 p-2 border rounded text-sm"
                                />
                                <div className="col-span-2 flex items-center gap-1">
                                    {v.image_url ? (
                                        <div className="relative group">
                                            <img
                                                src={v.image_url}
                                                alt=""
                                                className="w-10 h-10 object-cover rounded border"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => updateVariation(v._index, 'image_url', '')}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <label className="flex items-center gap-1 px-2 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded cursor-pointer text-xs">
                                            {uploadingIndex === v._index ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Upload className="w-3 h-3" />
                                            )}
                                            <span>Görsel</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0]
                                                    if (file) handleImageUpload(v._index, file)
                                                }}
                                                disabled={uploadingIndex === v._index}
                                            />
                                        </label>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => removeVariation(v._index)}
                                    className="col-span-1 p-2 text-red-500 hover:bg-red-50 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            {variations.length === 0 && (
                <p className="text-sm text-purple-500 text-center py-4">
                    Henüz varyasyon eklenmedi
                </p>
            )}
        </div>
    )
}
