'use client'

import * as React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2, Edit2, Save, X, Loader2, ArrowUp, ArrowDown } from 'lucide-react'

interface Menu {
    id: number
    title: string
    url: string
    parent_id: number | null
    sort_order: number
    is_active: number
}

export default function MenusPage() {
    const [menus, setMenus] = React.useState<Menu[]>([])
    const [loading, setLoading] = React.useState(true)
    const [editingId, setEditingId] = React.useState<number | null>(null)
    const [formData, setFormData] = React.useState<Partial<Menu>>({
        title: '',
        url: '',
        parent_id: null,
        sort_order: 0,
        is_active: 1
    })

    const fetchMenus = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/menus')
            const data = await res.json()
            if (Array.isArray(data)) setMenus(data)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    React.useEffect(() => {
        fetchMenus()
    }, [])

    const handleDelete = async (id: number) => {
        if (!confirm('Bu menüyü silmek istediğinize emin misiniz?')) return
        try {
            await fetch(`/api/admin/menus?id=${id}`, { method: 'DELETE' })
            setMenus(prev => prev.filter(m => m.id !== id))
        } catch (error) {
            alert('Silme işlemi başarısız')
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const method = editingId ? 'PUT' : 'POST'
            const body = editingId ? { ...formData, id: editingId } : formData

            const res = await fetch('/api/admin/menus', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })

            if (res.ok) {
                setEditingId(null)
                setFormData({ title: '', url: '', parent_id: null, sort_order: 0, is_active: 1 })
                fetchMenus()
            } else {
                alert('Kaydetme başarısız')
            }
        } catch (error) {
            alert('Hata oluştu')
        }
    }

    const startEdit = (menu: Menu) => {
        setEditingId(menu.id)
        setFormData(menu)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setFormData({ title: '', url: '', parent_id: null, sort_order: 0, is_active: 1 })
    }

    // Sort menus locally
    const rootMenus = menus.filter(m => !m.parent_id).sort((a, b) => a.sort_order - b.sort_order)
    const getChildren = (parentId: number) => menus.filter(m => m.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order)

    if (loading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">Menü Yönetimi</h1>

            {/* Add/Edit Form */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
                <h2 className="text-lg font-semibold mb-4">{editingId ? 'Menü Düzenle' : 'Yeni Menü Ekle'}</h2>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium mb-1">Başlık</label>
                        <Input
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            required
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium mb-1">URL</label>
                        <Input
                            value={formData.url || ''}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            placeholder="/example"
                        />
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium mb-1">Üst Menü</label>
                        <select
                            className="w-full p-2 border rounded-lg h-10 text-sm"
                            value={formData.parent_id || ''}
                            onChange={e => setFormData({ ...formData, parent_id: e.target.value ? Number(e.target.value) : null })}
                        >
                            <option value="">Yok (Ana Menü)</option>
                            {rootMenus.filter(m => m.id !== editingId).map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                            ))}
                        </select>
                    </div>
                    <div className="lg:col-span-1">
                        <label className="block text-sm font-medium mb-1">Sıra</label>
                        <Input
                            type="number"
                            value={formData.sort_order}
                            onChange={e => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button type="submit" className="flex-1 bg-slate-900 text-white">
                            {editingId ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            {editingId ? 'Güncelle' : 'Ekle'}
                        </Button>
                        {editingId && (
                            <Button type="button" variant="outline" onClick={cancelEdit}>
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </form>
            </div>

            {/* Menu List */}
            <div className="space-y-4">
                {rootMenus.map(menu => (
                    <div key={menu.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                        <div className="flex items-center justify-between p-4 bg-slate-50">
                            <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-900">{menu.title}</span>
                                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded">{menu.url}</span>
                                {!menu.is_active && <span className="text-xs text-red-500 font-medium">Pasif</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 mr-2">Sıra: {menu.sort_order}</span>
                                <Button size="sm" variant="ghost" onClick={() => startEdit(menu)}>
                                    <Edit2 className="w-4 h-4 text-blue-600" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(menu.id)}>
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                            </div>
                        </div>
                        {/* Children */}
                        {getChildren(menu.id).length > 0 && (
                            <div className="p-2 pl-8 border-t border-slate-100 bg-white space-y-2">
                                {getChildren(menu.id).map(child => (
                                    <div key={child.id} className="flex items-center justify-between p-2 rounded hover:bg-slate-50 border border-transparent hover:border-slate-100">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-slate-700">↳ {child.title}</span>
                                            <span className="text-xs text-slate-400">{child.url}</span>
                                            {!child.is_active && <span className="text-xs text-red-500 font-medium">Pasif</span>}
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <span className="text-xs text-slate-400 mr-2">Sıra: {child.sort_order}</span>
                                            <Button size="sm" variant="ghost" className="h-8 w-8" onClick={() => startEdit(child)}>
                                                <Edit2 className="w-3 h-3 text-blue-600" />
                                            </Button>
                                            <Button size="sm" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(child.id)}>
                                                <Trash2 className="w-3 h-3 text-red-600" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                {menus.length === 0 && (
                    <div className="text-center py-10 text-slate-500">
                        Henüz menü eklenmemiş.
                    </div>
                )}
            </div>
        </div>
    )
}
