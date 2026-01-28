'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Upload, Save, Loader2 } from 'lucide-react'

export default function AdminSettingsPage() {
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [uploading, setUploading] = React.useState(false)

    const [settings, setSettings] = React.useState({
        site_name: 'Onopo',
        logo_url: '',
        footer_text: '© 2024 Onopo. Tüm hakları saklıdır.',
        footer_email: 'info@onopo.com',
        footer_phone: '+90 555 123 4567',
        footer_address: 'İstanbul, Türkiye'
    })

    React.useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => {
                setSettings(prev => ({ ...prev, ...data }))
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target
        setSettings(prev => ({ ...prev, [name]: value }))
    }

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const data = new FormData()
            data.append('file', file)
            const res = await fetch('/api/admin/upload', { method: 'POST', body: data })
            if (!res.ok) throw new Error()
            const result = await res.json()
            setSettings(prev => ({ ...prev, logo_url: result.url }))
        } catch {
            alert('Logo yüklenemedi')
        } finally {
            setUploading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            if (res.ok) {
                alert('Ayarlar kaydedildi!')
            }
        } catch {
            alert('Kaydetme hatası')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Site Ayarları</h1>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
                {/* Logo Upload */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Site Logosu</label>
                    <div className="flex items-center gap-4">
                        {settings.logo_url ? (
                            <img src={settings.logo_url} alt="Logo" className="h-12 object-contain" />
                        ) : (
                            <div className="h-12 px-4 bg-slate-100 rounded-lg flex items-center text-slate-500">
                                Logo yok
                            </div>
                        )}
                        <label className="cursor-pointer">
                            <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-2">
                                <Upload className="w-4 h-4" />
                                {uploading ? 'Yükleniyor...' : 'Logo Yükle'}
                            </span>
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={uploading} />
                        </label>
                        {settings.logo_url && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSettings(prev => ({ ...prev, logo_url: '' }))}
                                className="text-red-500 hover:text-red-600"
                            >
                                Kaldır
                            </Button>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Logo, header'daki "Onopo" yazısının yerine gösterilir.</p>
                </div>

                {/* Site Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Site Adı</label>
                    <input
                        name="site_name"
                        value={settings.site_name}
                        onChange={handleChange}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </div>

                {/* Footer Text */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Footer Metin</label>
                    <input
                        name="footer_text"
                        value={settings.footer_text}
                        onChange={handleChange}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </div>

                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">E-posta</label>
                        <input
                            name="footer_email"
                            value={settings.footer_email}
                            onChange={handleChange}
                            className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Telefon</label>
                        <input
                            name="footer_phone"
                            value={settings.footer_phone}
                            onChange={handleChange}
                            className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Adres</label>
                    <textarea
                        name="footer_address"
                        value={settings.footer_address}
                        onChange={handleChange}
                        rows={2}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                </div>

                {/* Save Button */}
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
