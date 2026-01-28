'use client'

import * as React from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'

export default function EditPagePage() {
    const router = useRouter()
    const params = useParams()
    const slug = params.slug as string

    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [page, setPage] = React.useState({ title: '', content: '' })

    React.useEffect(() => {
        fetch(`/api/pages/${slug}`)
            .then(r => r.json())
            .then(data => {
                if (data && !data.error) {
                    setPage({ title: data.title || '', content: data.content || '' })
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/pages/${slug}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(page)
            })
            if (res.ok) {
                alert('Sayfa kaydedildi!')
                router.push('/admin/pages')
            }
        } catch {
            alert('Kaydetme hatası')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div className="max-w-3xl">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold text-slate-900">Sayfa Düzenle</h1>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Sayfa Başlığı</label>
                    <input
                        value={page.title}
                        onChange={e => setPage(p => ({ ...p, title: e.target.value }))}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">İçerik (Markdown destekli)</label>
                    <textarea
                        value={page.content}
                        onChange={e => setPage(p => ({ ...p, content: e.target.value }))}
                        rows={20}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono text-sm"
                        placeholder="# Başlık&#10;&#10;İçerik buraya..."
                    />
                </div>

                <div className="pt-4 border-t">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-lg gap-2"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Kaydet
                    </Button>
                </div>
            </div>
        </div>
    )
}
