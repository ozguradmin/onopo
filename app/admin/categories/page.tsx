'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import {
    Plus, Trash2, Edit, Save, X, Check,
    Laptop, Sparkles, Gamepad2, Package, Zap, Heart,
    Shirt, Home, Camera, Headphones, Watch, Gift,
    ShoppingBag, Star, Tv, Phone, Tablet, Monitor,
    Printer, Speaker, Keyboard, Mouse, Coffee, Book,
    Bike, Car, Plane, Music, Film, Palette
} from 'lucide-react'

// Icon options for category selection
const iconOptions = [
    { name: 'laptop', icon: Laptop, label: 'Laptop' },
    { name: 'sparkles', icon: Sparkles, label: 'Kozmetik' },
    { name: 'gamepad', icon: Gamepad2, label: 'Oyun' },
    { name: 'package', icon: Package, label: 'Paket' },
    { name: 'zap', icon: Zap, label: 'Elektrik' },
    { name: 'heart', icon: Heart, label: 'Kalp' },
    { name: 'shirt', icon: Shirt, label: 'Giyim' },
    { name: 'home', icon: Home, label: 'Ev' },
    { name: 'camera', icon: Camera, label: 'Kamera' },
    { name: 'headphones', icon: Headphones, label: 'Kulaklık' },
    { name: 'watch', icon: Watch, label: 'Saat' },
    { name: 'gift', icon: Gift, label: 'Hediye' },
    { name: 'shopping', icon: ShoppingBag, label: 'Alışveriş' },
    { name: 'star', icon: Star, label: 'Yıldız' },
    { name: 'tv', icon: Tv, label: 'TV' },
    { name: 'phone', icon: Phone, label: 'Telefon' },
    { name: 'tablet', icon: Tablet, label: 'Tablet' },
    { name: 'monitor', icon: Monitor, label: 'Monitör' },
    { name: 'printer', icon: Printer, label: 'Yazıcı' },
    { name: 'speaker', icon: Speaker, label: 'Hoparlör' },
    { name: 'keyboard', icon: Keyboard, label: 'Klavye' },
    { name: 'mouse', icon: Mouse, label: 'Mouse' },
    { name: 'coffee', icon: Coffee, label: 'Kahve' },
    { name: 'book', icon: Book, label: 'Kitap' },
    { name: 'bike', icon: Bike, label: 'Bisiklet' },
    { name: 'car', icon: Car, label: 'Araba' },
    { name: 'plane', icon: Plane, label: 'Uçak' },
    { name: 'music', icon: Music, label: 'Müzik' },
    { name: 'film', icon: Film, label: 'Film' },
    { name: 'palette', icon: Palette, label: 'Sanat' },
    // New additions
    { name: 'tools', icon: Zap, label: 'Araçlar' }, // Using Zap as placeholder for Tools if not imported
    { name: 'baby', icon: Heart, label: 'Bebek' },
    { name: 'sport', icon: Bike, label: 'Spor' },
    { name: 'furniture', icon: Home, label: 'Mobilya' },
    { name: 'pet', icon: Heart, label: 'Evcil Hayvan' },
    { name: 'garden', icon: Home, label: 'Bahçe' },
    { name: 'kitchen', icon: Coffee, label: 'Mutfak' },
    { name: 'office', icon: Printer, label: 'Ofis' },
]

interface Category {
    id: number
    name: string
    slug: string
    icon?: string
    product_count?: number
}

export default function AdminCategoriesPage() {
    const [categories, setCategories] = React.useState<Category[]>([])
    const [loading, setLoading] = React.useState(true)
    const [newCatName, setNewCatName] = React.useState('')
    const [newCatIcon, setNewCatIcon] = React.useState('package')
    const [editingId, setEditingId] = React.useState<number | null>(null)
    const [editName, setEditName] = React.useState('')
    const [editIcon, setEditIcon] = React.useState('')
    const [showIconPicker, setShowIconPicker] = React.useState<number | 'new' | null>(null)

    const fetchCategories = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/categories')
            const data = await res.json()
            setCategories(Array.isArray(data) ? data : [])
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchCategories()
    }, [])

    const getIconComponent = (iconName: string) => {
        const found = iconOptions.find(i => i.name === iconName)
        return found ? found.icon : Package
    }

    const handleAddCategory = async () => {
        if (!newCatName.trim()) return
        try {
            await fetch('/api/categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCatName, icon: newCatIcon })
            })
            setNewCatName('')
            setNewCatIcon('package')
            fetchCategories()
        } catch (err) {
            console.error(err)
        }
    }

    const handleUpdateCategory = async (id: number) => {
        try {
            await fetch(`/api/categories/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName, icon: editIcon })
            })
            setEditingId(null)
            fetchCategories()
        } catch (err) {
            console.error(err)
        }
    }

    const handleDeleteCategory = async (id: number) => {
        if (!confirm('Bu kategoriyi silmek istediğinize emin misiniz?')) return
        try {
            await fetch(`/api/categories/${id}`, { method: 'DELETE' })
            fetchCategories()
        } catch (err) {
            console.error(err)
        }
    }

    const startEditing = (cat: Category) => {
        setEditingId(cat.id)
        setEditName(cat.name)
        setEditIcon(cat.icon || 'package')
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Kategoriler</h1>
            </div>

            {/* Add new category */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">Yeni Kategori Ekle</h2>
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kategori Adı</label>
                        <input
                            type="text"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            placeholder="Kategori adı..."
                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                        />
                    </div>
                    <div className="relative">
                        <label className="block text-sm font-medium text-slate-700 mb-1">İkon</label>
                        <button
                            onClick={() => setShowIconPicker(showIconPicker === 'new' ? null : 'new')}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50"
                        >
                            {React.createElement(getIconComponent(newCatIcon), { className: "w-5 h-5" })}
                            <span className="text-sm">{iconOptions.find(i => i.name === newCatIcon)?.label || 'Seç'}</span>
                        </button>
                        {showIconPicker === 'new' && (
                            <div className="absolute z-10 top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-80 max-h-60 overflow-y-auto">
                                <div className="grid grid-cols-5 gap-2">
                                    {iconOptions.map(opt => (
                                        <button
                                            key={opt.name}
                                            onClick={() => { setNewCatIcon(opt.name); setShowIconPicker(null) }}
                                            className={`p-2 rounded-lg hover:bg-slate-100 flex flex-col items-center gap-1 ${newCatIcon === opt.name ? 'bg-slate-100 ring-2 ring-slate-400' : ''}`}
                                            title={opt.label}
                                        >
                                            <opt.icon className="w-6 h-6" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <Button onClick={handleAddCategory} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Ekle
                    </Button>
                </div>
            </div>

            {/* Categories list */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">İkon</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kategori Adı</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Slug</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ürün</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {categories.map(cat => {
                            const IconComponent = getIconComponent(cat.icon || 'package')
                            const isEditing = editingId === cat.id

                            return (
                                <tr key={cat.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <div className="relative">
                                                <button
                                                    onClick={() => setShowIconPicker(showIconPicker === cat.id ? null : cat.id)}
                                                    className="p-2 border border-slate-200 rounded-lg hover:bg-slate-100"
                                                >
                                                    {React.createElement(getIconComponent(editIcon), { className: "w-5 h-5" })}
                                                </button>
                                                {showIconPicker === cat.id && (
                                                    <div className="absolute z-10 top-full left-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-xl p-4 w-80 max-h-60 overflow-y-auto">
                                                        <div className="grid grid-cols-5 gap-2">
                                                            {iconOptions.map(opt => (
                                                                <button
                                                                    key={opt.name}
                                                                    onClick={() => { setEditIcon(opt.name); setShowIconPicker(null) }}
                                                                    className={`p-2 rounded-lg hover:bg-slate-100 flex flex-col items-center gap-1 ${editIcon === opt.name ? 'bg-slate-100 ring-2 ring-slate-400' : ''}`}
                                                                    title={opt.label}
                                                                >
                                                                    <opt.icon className="w-6 h-6" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                                <IconComponent className="w-5 h-5 text-slate-600" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="px-3 py-1.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 outline-none"
                                            />
                                        ) : (
                                            <span className="font-medium text-slate-900">{cat.name}</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <code className="text-sm bg-slate-100 px-2 py-1 rounded">{cat.slug}</code>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-sm text-slate-500">{cat.product_count || 0}</span>
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {isEditing ? (
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                                                    <X className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" onClick={() => handleUpdateCategory(cat.id)}>
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-end gap-2">
                                                <Button size="sm" variant="outline" onClick={() => startEditing(cat)}>
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => handleDeleteCategory(cat.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {categories.length === 0 && !loading && (
                            <tr>
                                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                                    Henüz kategori eklenmemiş
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
