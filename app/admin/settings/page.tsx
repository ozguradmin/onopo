'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Lock, Save } from 'lucide-react'

export default function AdminSettingsPage() {
    const router = useRouter()
    const [user, setUser] = React.useState<any>(null)
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)

    // Profile Form
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [confirmPassword, setConfirmPassword] = React.useState('')

    // Site Settings Form
    const [siteName, setSiteName] = React.useState('Onopo')
    const [logoUrl, setLogoUrl] = React.useState('')
    const [footerText, setFooterText] = React.useState('')

    React.useEffect(() => {
        Promise.all([
            fetch('/api/auth/me').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json())
        ]).then(([userData, settingsData]) => {
            if (userData.user) {
                setUser(userData.user)
                setEmail(userData.user.email)
            }
            if (settingsData) {
                setSiteName(settingsData.site_name || 'Onopo')
                setLogoUrl(settingsData.logo_url || '')
                setFooterText(settingsData.footer_text || '')
            }
            setLoading(false)
        }).catch(() => setLoading(false))
    }, [])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password && password !== confirmPassword) {
            alert('Şifreler uyuşmuyor')
            return
        }

        setSaving(true)
        try {
            // Update Profile
            const profileRes = await fetch('/api/admin/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: password || undefined })
            })

            // Update Site Settings
            const settingsRes = await fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    site_name: siteName,
                    logo_url: logoUrl,
                    footer_text: footerText
                })
            })

            if (profileRes.ok && settingsRes.ok) {
                alert('Tüm ayarlar güncellendi')
                setPassword('')
                setConfirmPassword('')
            } else {
                throw new Error('Güncelleme kısmen başarısız oldu')
            }
        } catch (error) {
            alert('Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Yükleniyor...</div>

    return (
        <div className="max-w-4xl mx-auto pb-10">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold">Admin & Site Ayarları</h1>
            </div>

            <div className="grid gap-8">
                {/* Site Settings Section */}
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                            <Save className="w-4 h-4" />
                        </span>
                        Site Görünüm Ayarları
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Site Adı</label>
                            <input
                                type="text"
                                value={siteName}
                                onChange={e => setSiteName(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Logo URL</label>
                            <input
                                type="text"
                                value={logoUrl}
                                onChange={e => setLogoUrl(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                                placeholder="https://..."
                            />
                            {logoUrl && <img src={logoUrl} className="mt-2 h-10 object-contain border p-1 rounded" />}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Footer Metni</label>
                            <input
                                type="text"
                                value={footerText}
                                onChange={e => setFooterText(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Profile Settings Section */}
                <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
                    <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <User className="w-4 h-4" />
                        </span>
                        Admin Profil Ayarları
                    </h2>
                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium mb-1">E-posta Adresi</label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-400">
                                    <User className="w-5 h-5" />
                                </span>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-10 p-2 border rounded-lg"
                                    required
                                />
                            </div>
                        </div>

                        <div className="border-t pt-6">
                            <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">Güvenlik</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">Yeni Şifre</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </span>
                                        <input
                                            type="password"
                                            value={password}
                                            onChange={e => setPassword(e.target.value)}
                                            className="w-full pl-10 p-2 border rounded-lg"
                                            placeholder="Değiştirmek istemiyorsanız boş bırakın"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Yeni Şifre (Tekrar)</label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </span>
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            className="w-full pl-10 p-2 border rounded-lg"
                                            placeholder="Tekrar girin"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <Button type="submit" disabled={saving} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-12 text-lg">
                            {saving ? 'Tüm Ayarları Kaydet' : 'Ayarları Güncelle'}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
