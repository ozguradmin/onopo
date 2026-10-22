'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, User, Lock, Save, Upload, X, Image, Facebook, Instagram, Twitter, Youtube, Linkedin } from 'lucide-react'

// The storefront listing rounds products_per_page UP to a multiple of 12 between 12 and 96, so every
// page fills whole rows in the 2/3/4-column grids (lib/listing-data.ts listingPageSize; an unset or
// invalid value counts as 20, lib/catalog.ts). Only values the storefront really uses are offered.
const PRODUCTS_PER_PAGE_OPTIONS = ['12', '24', '48', '96']

/** What the storefront actually shows for a stored products_per_page value. */
function storefrontProductsPerPage(stored: unknown): string {
    const n = parseInt(String(stored ?? ''), 10)
    const perPage = Number.isFinite(n) && n > 0 && n <= 200 ? n : 20
    return String(Math.min(96, Math.max(12, Math.ceil(perPage / 12) * 12)))
}

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

    // Social Media URLs
    const [facebookUrl, setFacebookUrl] = React.useState('https://www.facebook.com/people/Onopostorecom/61572923320449/')
    const [instagramUrl, setInstagramUrl] = React.useState('https://www.instagram.com/onopostorecom/?igsh=aXgyYzMxbWlnaHJ0&utm_source=qr#')
    const [twitterUrl, setTwitterUrl] = React.useState('https://x.com/onopostore')
    const [youtubeUrl, setYoutubeUrl] = React.useState('https://www.youtube.com/@onopostore')
    const [linkedinUrl, setLinkedinUrl] = React.useState('')

    // Footer Social Media Visibility
    const [footerSocialVisible, setFooterSocialVisible] = React.useState(false)

    // Admin Notification Email
    const [adminEmail, setAdminEmail] = React.useState('')

    // Products Per Page
    const [productsPerPage, setProductsPerPage] = React.useState('24')

    React.useEffect(() => {
        Promise.all([
            fetch('/api/auth/me').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json()),
            fetch('/api/categories', { cache: 'no-store' }).then(r => r.json())
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
                // Social media URLs
                if (settingsData.facebook_url !== undefined) setFacebookUrl(settingsData.facebook_url)
                if (settingsData.instagram_url !== undefined) setInstagramUrl(settingsData.instagram_url)
                if (settingsData.twitter_url !== undefined) setTwitterUrl(settingsData.twitter_url)
                if (settingsData.youtube_url !== undefined) setYoutubeUrl(settingsData.youtube_url)
                if (settingsData.linkedin_url !== undefined) setLinkedinUrl(settingsData.linkedin_url)
                if (settingsData.footer_social_visible !== undefined) setFooterSocialVisible(settingsData.footer_social_visible === 'true')
                setAdminEmail(settingsData.admin_email || '')
                // Shown as what the storefront uses (e.g. a stored 20 shows as 24); nothing is written until Kaydet
                setProductsPerPage(storefrontProductsPerPage(settingsData.products_per_page))
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
                    facebook_url: facebookUrl,
                    instagram_url: instagramUrl,
                    twitter_url: twitterUrl,
                    youtube_url: youtubeUrl,
                    linkedin_url: linkedinUrl,
                    footer_social_visible: footerSocialVisible ? 'true' : 'false',
                    admin_email: adminEmail,
                    products_per_page: productsPerPage
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

                        {/* Social Media URLs */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">📱 Sosyal Medya Hesapları</h3>
                            <p className="text-xs text-slate-500 mb-4">Burada girdiğiniz linkler hem TopBar hem Footer'da otomatik olarak kullanılır.</p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                        <Facebook className="w-4 h-4 text-blue-600" /> Facebook
                                    </label>
                                    <input
                                        type="url"
                                        value={facebookUrl}
                                        onChange={e => setFacebookUrl(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="https://facebook.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                        <Instagram className="w-4 h-4 text-pink-600" /> Instagram
                                    </label>
                                    <input
                                        type="url"
                                        value={instagramUrl}
                                        onChange={e => setInstagramUrl(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="https://instagram.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                        <Twitter className="w-4 h-4 text-sky-500" /> X (Twitter)
                                    </label>
                                    <input
                                        type="url"
                                        value={twitterUrl}
                                        onChange={e => setTwitterUrl(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="https://x.com/..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                        <Youtube className="w-4 h-4 text-red-600" /> YouTube
                                    </label>
                                    <input
                                        type="url"
                                        value={youtubeUrl}
                                        onChange={e => setYoutubeUrl(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="https://youtube.com/@..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                                        <Linkedin className="w-4 h-4 text-blue-700" /> LinkedIn
                                    </label>
                                    <input
                                        type="url"
                                        value={linkedinUrl}
                                        onChange={e => setLinkedinUrl(e.target.value)}
                                        className="w-full p-2 border rounded-lg"
                                        placeholder="https://linkedin.com/..."
                                    />
                                </div>
                            </div>

                            {/* Footer Social Visibility Toggle */}
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg border">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <span className="font-medium text-sm">Footer'da Sosyal Medya İkonlarını Göster</span>
                                        <p className="text-xs text-slate-500 mt-1">Kapalıyken footer'da sosyal medya ikonları gizlenir, TopBar'da her zaman görünür</p>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="checkbox"
                                            checked={footerSocialVisible}
                                            onChange={e => setFooterSocialVisible(e.target.checked)}
                                            className="sr-only peer"
                                        />
                                        <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                                    </div>
                                </label>
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

                        {/* Products Per Page Setting */}
                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-4 text-sm text-slate-500 uppercase tracking-wider">🛒 Ürün Listesi Ayarları</h3>
                            <div>
                                <label htmlFor="products-per-page" className="block text-sm font-medium mb-1">Sayfa Başına Ürün Sayısı</label>
                                <p className="text-xs text-slate-500 mb-2">Ürünler ve kategori sayfalarında kaç ürün gösterilsin (satırlar tam dolsun diye 12'nin katları)</p>
                                <select
                                    id="products-per-page"
                                    value={productsPerPage}
                                    onChange={e => setProductsPerPage(e.target.value)}
                                    className="w-full p-2 border rounded-lg"
                                >
                                    {(PRODUCTS_PER_PAGE_OPTIONS.includes(productsPerPage)
                                        ? PRODUCTS_PER_PAGE_OPTIONS
                                        : [...PRODUCTS_PER_PAGE_OPTIONS, productsPerPage].sort((a, b) => Number(a) - Number(b))
                                    ).map(value => (
                                        <option key={value} value={value}>{value} ürün</option>
                                    ))}
                                </select>
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
