'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Plus, X, Menu, GripVertical } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function AdminHeaderPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [links, setLinks] = React.useState<{ label: string, href: string }[]>([])
    const [newLabel, setNewLabel] = React.useState('')
    const [newHref, setNewHref] = React.useState('')

    // Standard default links if none exist
    const defaultLinks = [
        { label: 'Anasayfa', href: '/' },
        { label: 'Teknoloji', href: '/tech' },
        { label: 'Kozmetik', href: '/beauty' },
        { label: 'Oyun', href: '/gaming' },
    ]

    React.useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => {
                if (data.header_links) {
                    try {
                        setLinks(JSON.parse(data.header_links))
                    } catch {
                        setLinks(defaultLinks)
                    }
                } else {
                    setLinks(defaultLinks)
                }
                setLoading(false)
            })
            .catch(() => {
                setLinks(defaultLinks)
                setLoading(false)
            })
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            await fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    header_links: JSON.stringify(links)
                })
            })
            alert('Menü güncellendi')
        } catch {
            alert('Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    const addLink = () => {
        if (!newLabel || !newHref) return
        setLinks([...links, { label: newLabel, href: newHref }])
        setNewLabel('')
        setNewHref('')
    }

    const removeLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index))
    }

    const moveLink = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return
        if (direction === 'down' && index === links.length - 1) return

        const newLinks = [...links]
        const targetIndex = direction === 'up' ? index - 1 : index + 1
            ;[newLinks[index], newLinks[targetIndex]] = [newLinks[targetIndex], newLinks[index]]
        setLinks(newLinks)
    }

    if (loading) return <div>Yükleniyor...</div>

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={() => router.back()}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                    </Button>
                    <h1 className="text-2xl font-bold">Menü Yönetimi</h1>
                </div>
                <Button onClick={handleSave} disabled={saving} className="bg-slate-900 text-white">
                    {saving ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}
                </Button>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* Available Categories / Helper */}
                <div className="md:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="font-semibold mb-4">Hızlı Ekle</h3>
                        <div className="space-y-2">
                            <HelperBtn label="Anasayfa" href="/" set={setLinks} current={links} />
                            <HelperBtn label="Tüm Ürünler" href="/products" set={setLinks} current={links} />
                            <HelperBtn label="Teknoloji" href="/tech" set={setLinks} current={links} />
                            <HelperBtn label="Kozmetik" href="/beauty" set={setLinks} current={links} />
                            <HelperBtn label="Oyun" href="/gaming" set={setLinks} current={links} />
                            <HelperBtn label="Yeni Gelenler" href="/new" set={setLinks} current={links} />
                        </div>
                    </div>
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-sm text-blue-800">
                        <p>Burada üst menüde görünecek linkleri düzenleyebilirsiniz. Sürükleyip bırakarak (yakında) veya ok tuşlarıyla sırasını değiştirebilirsiniz.</p>
                    </div>
                </div>

                {/* Editor */}
                <div className="md:col-span-2">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6">
                        <div className="flex gap-2 mb-4">
                            <input
                                placeholder="Başlık (Örn: İndirimler)"
                                value={newLabel}
                                onChange={e => setNewLabel(e.target.value)}
                                className="flex-1 p-2 border rounded-lg text-sm"
                            />
                            <input
                                placeholder="Link (Örn: /discount)"
                                value={newHref}
                                onChange={e => setNewHref(e.target.value)}
                                className="flex-1 p-2 border rounded-lg text-sm"
                            />
                            <Button onClick={addLink} variant="outline">
                                <Plus className="w-4 h-4" />
                            </Button>
                        </div>

                        <div className="space-y-2">
                            {links.map((link, idx) => (
                                <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 group">
                                    <span className="text-slate-400">
                                        <Menu className="w-4 h-4" />
                                    </span>
                                    <div className="flex-1">
                                        <div className="font-medium text-sm">{link.label}</div>
                                        <div className="text-xs text-slate-500">{link.href}</div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => moveLink(idx, 'up')} disabled={idx === 0} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30">↑</button>
                                        <button onClick={() => moveLink(idx, 'down')} disabled={idx === links.length - 1} className="p-1 hover:bg-slate-200 rounded disabled:opacity-30">↓</button>
                                        <button onClick={() => removeLink(idx)} className="p-1 hover:bg-red-100 text-red-500 rounded ml-2">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {links.length === 0 && (
                                <div className="text-center py-8 text-slate-400 text-sm">
                                    Henüz link eklenmemiş.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

function HelperBtn({ label, href, set, current }: any) {
    return (
        <button
            onClick={() => set([...current, { label, href }])}
            className="block w-full text-left px-3 py-2 rounded hover:bg-slate-50 text-sm text-slate-600 transition-colors"
        >
            + {label}
        </button>
    )
}
