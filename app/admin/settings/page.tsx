'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Lock, Save, Upload, X, Image } from 'lucide-react'

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
    const [siteUrl, setSiteUrl] = React.useState('')
    const [logoUrl, setLogoUrl] = React.useState('')
    const [faviconUrl, setFaviconUrl] = React.useState('')
    const [footerText, setFooterText] = React.useState('')
    const [siteDescription, setSiteDescription] = React.useState('')

    // Footer Categories
    const [allCategories, setAllCategories] = React.useState<any[]>([])
    const [footerCategories, setFooterCategories] = React.useState<string[]>([])

    // Footer Contact Info
    const [footerEmail, setFooterEmail] = React.useState('')
    const [footerPhone, setFooterPhone] = React.useState('')
    const [footerAddress, setFooterAddress] = React.useState('')

    // Admin Notification Email
    const [adminEmail, setAdminEmail] = React.useState('')

    React.useEffect(() => {
        Promise.all([
            fetch('/api/auth/me').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json()),
            fetch('/api/categories').then(r => r.json())
        ]).then(([userData, settingsData, categoriesData]) => {
            if (userData.user) {
                setUser(userData.user)
                setEmail(userData.user.email)
            }
            if (settingsData) {
                setSiteName(settingsData.site_name || 'Onopo')
                setSiteUrl(settingsData.site_url || '')
                setLogoUrl(settingsData.logo_url || '')
                setFaviconUrl(settingsData.favicon_url || '')
                setFooterText(settingsData.footer_text || '')
                setSiteDescription(settingsData.site_description || '')
                // Parse footer categories from JSON
                try {
                    const fc = settingsData.footer_categories ? JSON.parse(settingsData.footer_categories) : []
                    setFooterCategories(Array.isArray(fc) ? fc : [])
                } catch { setFooterCategories([]) }
                // Footer contact info
                setFooterEmail(settingsData.footer_email || '')
                setFooterPhone(settingsData.footer_phone || '')
                setFooterAddress(settingsData.footer_address || '')
                setAdminEmail(settingsData.admin_email || '')
            }
            if (Array.isArray(categoriesData)) {
                setAllCategories(categoriesData)
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
                    site_url: siteUrl,
                    logo_url: logoUrl,
                    favicon_url: faviconUrl,
                    footer_text: footerText,
                    site_description: siteDescription,
                    footer_categories: JSON.stringify(footerCategories),
                    footer_email: footerEmail,
                    footer_phone: footerPhone,
                    footer_address: footerAddress,
                    admin_email: adminEmail
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
                            <label className="block text-sm font-medium mb-1">Site URL (Linkler için)</label>
                            <p className="text-xs text-slate-500 mb-2">Örn: https://onopostore.com (Sonunda / işareti olmayacak)</p>
                            <input
                                type="url"
                                value={siteUrl}
                                onChange={e => setSiteUrl(e.target.value)}
                                className="w-full p-2 border rounded-lg"
                                placeholder="https://onopostore.com"
                            />
                        </div>

                        {/* Logo Upload */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Logo</label>
                            <div className="flex items-center gap-4">
                                {logoUrl && (
                                    <div className="relative group">
                                        <img src={logoUrl} className="h-12 w-auto object-contain border p-1 rounded bg-slate-50" />
                                        <button
                                            type="button"
                                            onClick={() => setLogoUrl('')}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                <label className="cursor-pointer">
                                    <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-2">
                                        <Upload className="w-4 h-4" />
                                        {logoUrl ? 'Logoyu Değiştir' : 'Logo Yükle'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            const data = new FormData()
                                            data.append('file', file)
                                            try {
                                                const res = await fetch('/api/admin/upload', { method: 'POST', body: data })
                                                if (res.ok) {
                                                    const json = await res.json()
                                                    setLogoUrl(json.url)
                                                }
                                            } catch { }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        {/* Favicon Upload */}
                        <div>
                            <label className="block text-sm font-medium mb-1">Favicon (Sekme İkonu)</label>
                            <p className="text-xs text-slate-500 mb-2">Tarayıcı sekmesinde görünen küçük ikon (56x56 PNG önerilir)</p>
                            <div className="flex items-center gap-4">
                                {faviconUrl && (
                                    <div className="relative group">
                                        <img src={faviconUrl} className="h-14 w-14 object-contain border p-1 rounded bg-slate-50" />
                                        <button
                                            type="button"
                                            onClick={() => setFaviconUrl('')}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                                <label className="cursor-pointer">
                                    <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 text-sm flex items-center gap-2">
                                        <Image className="w-4 h-4" />
                                        {faviconUrl ? 'Değiştir' : 'Favicon Yükle'}
                                    </span>
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/png,image/x-icon,image/ico"
                                        onChange={async (e) => {
                                            const file = e.target.files?.[0]
                                            if (!file) return
                                            const data = new FormData()
                                            data.append('file', file)
                                            try {
                                                const res = await fetch('/api/admin/upload', { method: 'POST', body: data })
                                                if (res.ok) {
                                                    const json = await res.json()
                                                    setFaviconUrl(json.url)
                                                }
                                            } catch { }
                                        }}
                                    />
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Site Slogan / Açıklama (Hero Altı)</label>
                            <textarea
                                value={siteDescription}
                                onChange={e => setSiteDescription(e.target.value)}
                                className="w-full p-2 border rounded-lg h-20"
                                placeholder="Yaşam tarzı ve teknolojinin geleceğini tanımlıyoruz..."
                            />
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

                        {/* Footer Categories Selection */}
                        {allCategories.length > 0 && (
                            <div>
                                <label className="block text-sm font-medium mb-2">Footer Kategorileri</label>
                                <p className="text-xs text-slate-500 mb-3">Footer'da görünmesini istediğiniz kategorileri seçin</p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-slate-50">
                                    {allCategories.map((cat: any) => (
                                        <label key={cat.id || cat.slug} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded">
                                            <input
                                                type="checkbox"
                                                checked={footerCategories.includes(cat.name)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFooterCategories([...footerCategories, cat.name])
                                                    } else {
                                                        setFooterCategories(footerCategories.filter(c => c !== cat.name))
                                                    }
                                                }}
                                                className="rounded border-slate-300"
                                            />
                                            <span>{cat.name}</span>
                                        </label>
                                    ))}
                                </div>
                                <p className="text-xs text-slate-400 mt-2">
                                    Seçili: {footerCategories.length} kategori
                                </p>
                            </div>
                        )}

                        {/* Footer Contact Info */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">Footer İletişim Bilgileri</h3>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1">E-posta</label>
                                    <input
                                        type="email"
                                        value={footerEmail}
                                        onChange={e => setFooterEmail(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="info@onopo.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Telefon</label>
                                    <input
                                        type="tel"
                                        value={footerPhone}
                                        onChange={e => setFooterPhone(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="+90 555 123 4567"
                                    />
                                </div>
                            </div>
                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-1">Adres</label>
                                <input
                                    type="text"
                                    value={footerAddress}
                                    onChange={e => setFooterAddress(e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="İstanbul, Türkiye"
                                />
                            </div>
                        </div>

                        {/* Admin Notification Email */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">📧 Sipariş Bildirimleri</h3>
                            <div>
                                <label className="block text-sm font-medium mb-1">Admin Bildirim E-postası</label>
                                <p className="text-xs text-slate-500 mb-2">Yeni siparişler bu adrese bildirilir</p>
                                <input
                                    type="email"
                                    value={adminEmail}
                                    onChange={e => setAdminEmail(e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder="siparis@onopostore.com"
                                />
                            </div>
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
