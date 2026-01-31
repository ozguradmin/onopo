'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    GripVertical,
    Plus,
    Trash2,
    Edit,
    Eye,
    EyeOff,
    Image as ImageIcon,
    Package,
    Star,
    MessageSquare,
    Loader2,
    Save,
    ChevronDown,
    ChevronUp,
    X,
    Code
} from 'lucide-react'

interface Section {
    id: number
    type: string
    title: string
    config: any
    display_order: number
    is_active: number
}

const sectionTypes = [
    { type: 'hero', label: 'Hero Slider', icon: ImageIcon },
    { type: 'products', label: 'Ürün Bölümü', icon: Package },
    { type: 'new_products', label: 'Yeni Ürünler', icon: Star },
    { type: 'categories', label: 'Kategoriler', icon: Package },
    { type: 'features', label: 'Özellikler', icon: Star },
    { type: 'image_card', label: 'Görsel Kart', icon: ImageIcon },
    { type: 'custom_code', label: 'Özel HTML/CSS', icon: Code },
]

export default function AdminHomepagePage() {
    const [sections, setSections] = React.useState<Section[]>([])
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [editingSection, setEditingSection] = React.useState<Section | null>(null)
    const [showAddModal, setShowAddModal] = React.useState(false)

    const fetchSections = React.useCallback(() => {
        fetch('/api/homepage-sections')
            .then(r => r.json())
            .then(data => {
                setSections(data || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    React.useEffect(() => { fetchSections() }, [fetchSections])

    const moveSection = async (id: number, direction: 'up' | 'down') => {
        const idx = sections.findIndex(s => s.id === id)
        if (idx === -1) return
        if (direction === 'up' && idx === 0) return
        if (direction === 'down' && idx === sections.length - 1) return

        const newSections = [...sections]
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1
            ;[newSections[idx], newSections[swapIdx]] = [newSections[swapIdx], newSections[idx]]

        // Update display_order
        const reordered = newSections.map((s, i) => ({ ...s, display_order: i + 1 }))
        setSections(reordered)

        // Save to server
        await fetch('/api/homepage-sections', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sections: reordered.map(s => ({ id: s.id, display_order: s.display_order })) })
        })
    }

    const toggleSection = async (id: number) => {
        const section = sections.find(s => s.id === id)
        if (!section) return

        await fetch(`/api/homepage-sections/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_active: !section.is_active })
        })

        setSections(sections.map(s =>
            s.id === id ? { ...s, is_active: s.is_active ? 0 : 1 } : s
        ))
    }

    const deleteSection = async (id: number) => {
        if (!confirm('Bu bölümü silmek istediğinize emin misiniz?')) return

        await fetch(`/api/homepage-sections/${id}`, { method: 'DELETE' })
        setSections(sections.filter(s => s.id !== id))
    }

    const addSection = async (type: string) => {
        const res = await fetch('/api/homepage-sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type,
                title: type === 'products' ? 'Trend Ürünler' : type === 'new_products' ? 'Yeni Ürünler' : type === 'features' ? 'Özellikler' : type === 'custom_code' ? 'Özel Bölüm' : 'Yeni Bölüm',
                config: (type === 'products' || type === 'new_products') ? { selection_type: type === 'new_products' ? 'newest' : 'all', limit: 8 } : type === 'custom_code' ? { html_content: '' } : {}
            })
        })
        if (res.ok) {
            setShowAddModal(false)
            fetchSections()
        }
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Ana Sayfa Düzenleyici</h1>
                <Button
                    onClick={() => setShowAddModal(true)}
                    className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
                >
                    <Plus className="w-4 h-4" /> Bölüm Ekle
                </Button>
            </div>

            {/* Sections List */}
            <div className="space-y-3">
                {sections.map((section, idx) => (
                    <div
                        key={section.id}
                        className={`bg-white rounded-xl border shadow-sm p-4 ${section.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
                            }`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col gap-1">
                                <button
                                    onClick={() => moveSection(section.id, 'up')}
                                    disabled={idx === 0}
                                    className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                                >
                                    <ChevronUp className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => moveSection(section.id, 'down')}
                                    disabled={idx === sections.length - 1}
                                    className="p-1 hover:bg-slate-100 rounded disabled:opacity-30"
                                >
                                    <ChevronDown className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                {section.type === 'hero' && <ImageIcon className="w-5 h-5 text-blue-500" />}
                                {section.type === 'products' && <Package className="w-5 h-5 text-green-500" />}
                                {section.type === 'new_products' && <Star className="w-5 h-5 text-orange-500" />}
                                {section.type === 'features' && <Star className="w-5 h-5 text-yellow-500" />}
                                {section.type === 'image_card' && <ImageIcon className="w-5 h-5 text-purple-500" />}
                                {section.type === 'custom_code' && <Code className="w-5 h-5 text-pink-500" />}
                            </div>

                            <div className="flex-1">
                                <p className="font-medium text-slate-900">{section.title}</p>
                                <p className="text-sm text-slate-500 capitalize">{section.type.replace('_', ' ')}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleSection(section.id)}
                                    className={section.is_active ? 'text-green-600' : 'text-slate-400'}
                                >
                                    {section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingSection(section)}
                                    className="text-blue-600"
                                >
                                    <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => deleteSection(section.id)}
                                    className="text-red-600"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </div>
                ))}

                {sections.length === 0 && (
                    <div className="bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
                        <p className="text-slate-500 mb-4">Henüz bölüm yok</p>
                        <Button onClick={() => setShowAddModal(true)} variant="outline">
                            <Plus className="w-4 h-4 mr-2" /> İlk Bölümü Ekle
                        </Button>
                    </div>
                )}
            </div>

            {/* Add Section Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold">Bölüm Ekle</h3>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {sectionTypes.map(st => (
                                <button
                                    key={st.type}
                                    onClick={() => addSection(st.type)}
                                    className="p-4 border border-slate-200 rounded-xl hover:border-slate-900 hover:bg-slate-50 transition-colors text-left"
                                >
                                    <st.icon className="w-8 h-8 mb-2 text-slate-600" />
                                    <p className="font-medium">{st.label}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Section Modal */}
            {editingSection && (
                <SectionEditor
                    section={editingSection}
                    onClose={() => setEditingSection(null)}
                    onSave={() => {
                        setEditingSection(null)
                        fetchSections()
                    }}
                />
            )}
        </div>
    )
}

function SectionEditor({ section, onClose, onSave }: { section: Section, onClose: () => void, onSave: () => void }) {
    const [title, setTitle] = React.useState(section.title)
    const [config, setConfig] = React.useState(section.config || {})
    const [saving, setSaving] = React.useState(false)
    const [products, setProducts] = React.useState<any[]>([])
    const [categories, setCategories] = React.useState<any[]>([])

    React.useEffect(() => {
        if (section.type === 'products' || section.type === 'new_products') {
            fetch('/api/products').then(r => r.json()).then(data => setProducts(Array.isArray(data) ? data : []))
            fetch('/api/categories?hideEmpty=true').then(r => r.json()).then(data => setCategories(Array.isArray(data) ? data : []))
        }
    }, [section.type])

    const handleSave = async () => {
        setSaving(true)
        await fetch(`/api/homepage-sections/${section.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, config })
        })
        setSaving(false)
        onSave()
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Bölümü Düzenle</h3>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Başlık</label>
                        <input
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full p-3 border border-slate-200 rounded-lg"
                        />
                    </div>

                    {(section.type === 'products' || section.type === 'new_products') && (
                        <div>
                            <label className="block text-sm font-medium mb-2">Açıklama (Opsiyonel)</label>
                            <input
                                value={config.description || ''}
                                onChange={e => setConfig({ ...config, description: e.target.value })}
                                className="w-full p-3 border border-slate-200 rounded-lg"
                                placeholder="Bölüm için kısa açıklama..."
                            />
                        </div>
                    )}

                    {(section.type === 'products' || section.type === 'new_products') && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Ürün Seçimi</label>
                                <select
                                    value={config.selection_type || 'all'}
                                    onChange={e => setConfig({ ...config, selection_type: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-lg"
                                >
                                    <option value="all">Tüm Ürünler</option>
                                    <option value="newest">En Yeni Eklenenler</option>
                                    <option value="category">Kategoriye Göre</option>
                                    <option value="manual">Manuel Seçim</option>
                                </select>
                            </div>

                            {config.selection_type === 'category' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">Kategori</label>
                                    <select
                                        value={config.category || ''}
                                        onChange={e => setConfig({ ...config, category: e.target.value })}
                                        className="w-full p-3 border border-slate-200 rounded-lg"
                                    >
                                        <option value="">Seçin...</option>
                                        {categories.map((c: any) => (
                                            <option key={c.id} value={c.name}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {config.selection_type === 'manual' && (
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium mb-2">Ürünleri Seçin</label>
                                    <div className="h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                        {products.map((p: any) => (
                                            <div key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded">
                                                <input
                                                    type="checkbox"
                                                    checked={(config.product_ids || []).includes(p.id)}
                                                    onChange={(e) => {
                                                        const current = config.product_ids || []
                                                        if (e.target.checked) setConfig({ ...config, product_ids: [...current, p.id] })
                                                        else setConfig({ ...config, product_ids: current.filter((id: number) => id !== p.id) })
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300"
                                                />
                                                <div className="flex-1 text-sm">
                                                    <div className="font-medium">{p.name}</div>
                                                    <div className="text-xs text-slate-500">{p.category} - {p.price} ₺</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-500">Seçilen ürünler sırasıyla listelenecektir.</p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium mb-2">Gösterilecek Ürün Sayısı</label>
                                <input
                                    type="number"
                                    value={config.limit || 8}
                                    onChange={e => setConfig({ ...config, limit: parseInt(e.target.value) })}
                                    className="w-full p-3 border border-slate-200 rounded-lg"
                                    min={1}
                                    max={20}
                                />
                            </div>
                        </>
                    )}

                    {section.type === 'features' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium">Özellikler (JSON)</label>
                            <textarea
                                value={JSON.stringify(config.items || [], null, 2)}
                                onChange={e => {
                                    try {
                                        setConfig({ ...config, items: JSON.parse(e.target.value) })
                                    } catch { }
                                }}
                                rows={10}
                                className="w-full p-3 border border-slate-200 rounded-lg font-mono text-sm"
                                placeholder='[{"icon": "truck", "title": "Hızlı Teslimat", "description": "Aynı gün kargo"}]'
                            />
                        </div>
                    )}

                    {section.type === 'image_card' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-2">Görsel (Cihazdan Seç)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0]
                                        if (!file) return

                                        const formData = new FormData()
                                        formData.append('file', file)

                                        try {
                                            const res = await fetch('/api/upload', {
                                                method: 'POST',
                                                body: formData
                                            })
                                            const data = await res.json()
                                            if (data.url) {
                                                setConfig({ ...config, image_url: data.url })
                                            }
                                        } catch (err) {
                                            console.error('Upload error:', err)
                                        }
                                    }}
                                    className="w-full p-3 border border-slate-200 rounded-lg file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                                />
                                {config.image_url && (
                                    <div className="mt-3 rounded-lg overflow-hidden border border-slate-200">
                                        <img
                                            src={config.image_url}
                                            alt="Preview"
                                            className="w-full h-48 object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2">Link (opsiyonel)</label>
                                <input
                                    value={config.link_url || ''}
                                    onChange={e => setConfig({ ...config, link_url: e.target.value })}
                                    className="w-full p-3 border border-slate-200 rounded-lg"
                                    placeholder="/products veya https://..."
                                />
                            </div>
                        </>
                    )}

                    {section.type === 'custom_code' && (
                        <div className="space-y-3">
                            <label className="block text-sm font-medium">HTML/CSS/JavaScript İçeriği</label>
                            <p className="text-xs text-slate-500">HTML, CSS (style etiketi ile) ve JavaScript (script etiketi ile) kodlarını buraya ekleyebilirsiniz.</p>
                            <textarea
                                value={config.html_content || ''}
                                onChange={e => setConfig({ ...config, html_content: e.target.value })}
                                rows={14}
                                className="w-full p-3 border border-slate-200 rounded-lg font-mono text-sm"
                                placeholder={`<div class="custom-banner">
  <style>
    .custom-banner { 
      padding: 40px; 
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
      border-radius: 12px;
    }
    .custom-banner h2 { font-size: 24px; margin-bottom: 10px; }
  </style>
  
  <h2>Özel Başlık</h2>
  <p id="dynamic-text">İçerik buraya...</p>
  
  <script>
    document.getElementById('dynamic-text').textContent = 'JavaScript ile dinamik içerik!';
  </script>
</div>`}
                            />
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-800">
                                    ⚠️ <strong>Dikkat:</strong> Buraya eklenen HTML, CSS ve JavaScript kodu doğrudan sayfada çalıştırılır.
                                    Sadece güvenilir kaynaklardan kod kullanın.
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 pt-4 border-t flex gap-3">
                    <Button variant="outline" onClick={onClose} className="flex-1">İptal</Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                        Kaydet
                    </Button>
                </div>
            </div>
        </div>
    )
}
