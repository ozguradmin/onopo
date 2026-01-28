'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, Trash2, Upload, Loader2, Save, GripVertical } from 'lucide-react'

interface Slide {
    id?: number
    title: string
    subtitle: string
    button_text: string
    button_link: string
    image_url: string
    display_order: number
}

export default function HeroEditorPage() {
    const router = useRouter()
    const [slides, setSlides] = React.useState<Slide[]>([])
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [uploading, setUploading] = React.useState<number | null>(null)

    React.useEffect(() => {
        fetch('/api/hero-slides')
            .then(r => r.json())
            .then(data => {
                setSlides(data || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const addSlide = () => {
        setSlides([...slides, {
            title: 'Yeni Slide',
            subtitle: 'Alt başlık',
            button_text: 'Keşfet',
            button_link: '/products',
            image_url: '',
            display_order: slides.length + 1
        }])
    }

    const updateSlide = (index: number, updates: Partial<Slide>) => {
        setSlides(slides.map((s, i) => i === index ? { ...s, ...updates } : s))
    }

    const removeSlide = (index: number) => {
        if (!confirm('Bu slide\'ı silmek istediğinize emin misiniz?')) return
        setSlides(slides.filter((_, i) => i !== index))
    }

    const handleImageUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(index)
        try {
            const data = new FormData()
            data.append('file', file)
            const res = await fetch('/api/admin/upload', { method: 'POST', body: data })
            if (!res.ok) throw new Error()
            const result = await res.json()
            updateSlide(index, { image_url: result.url })
        } catch {
            alert('Görsel yüklenemedi')
        } finally {
            setUploading(null)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/hero-slides', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slides })
            })
            if (res.ok) {
                alert('Hero slider kaydedildi!')
                router.push('/admin/homepage')
            }
        } catch {
            alert('Kaydetme hatası')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div>
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold text-slate-900">Hero Slider Düzenle</h1>
            </div>

            <div className="space-y-4">
                {slides.map((slide, index) => (
                    <div key={index} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                        <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center text-slate-400">
                                <GripVertical className="w-5 h-5" />
                                <span className="text-sm font-bold mt-1">{index + 1}</span>
                            </div>

                            {/* Image Preview */}
                            <div className="w-40 h-24 rounded-lg bg-slate-100 overflow-hidden flex-shrink-0">
                                {slide.image_url ? (
                                    <img src={slide.image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm">
                                        Görsel yok
                                    </div>
                                )}
                            </div>

                            {/* Fields */}
                            <div className="flex-1 grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Başlık</label>
                                    <input
                                        value={slide.title}
                                        onChange={e => updateSlide(index, { title: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Alt Başlık</label>
                                    <input
                                        value={slide.subtitle}
                                        onChange={e => updateSlide(index, { subtitle: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Buton Yazısı</label>
                                    <input
                                        value={slide.button_text}
                                        onChange={e => updateSlide(index, { button_text: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Buton Link</label>
                                    <input
                                        value={slide.button_link}
                                        onChange={e => updateSlide(index, { button_link: e.target.value })}
                                        className="w-full p-2 border border-slate-200 rounded-lg text-sm"
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                                <label className="cursor-pointer">
                                    <span className="bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        {uploading === index ? '...' : 'Görsel'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={e => handleImageUpload(index, e)}
                                        disabled={uploading !== null}
                                    />
                                </label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSlide(index)}
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {/* Add Slide Button */}
                <button
                    onClick={addSlide}
                    className="w-full p-6 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Slide Ekle
                </button>
            </div>

            {/* Save Button */}
            <div className="mt-6 sticky bottom-4">
                <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-lg gap-2"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Tüm Slide'ları Kaydet
                </Button>
            </div>
        </div>
    )
}
