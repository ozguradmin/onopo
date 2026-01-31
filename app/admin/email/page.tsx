'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Send, Users, User, CheckCircle, AlertCircle, Eye, Plus, Trash2, FileText } from 'lucide-react'

// Pre-defined email templates with premium styling
// Note: {{LOGO_URL}} will be replaced with actual logo from settings
const EMAIL_TEMPLATES = [
    {
        id: 'welcome',
        name: 'Hoş Geldin',
        subject: 'Onopo Store\'a Hoş Geldiniz! 🎉',
        message: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <!-- Header with Logo -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="{{LOGO_URL}}" alt="Onopo Store" style="height: 40px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px; font-weight: 600;">Hoş Geldiniz!</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; background: #ffffff;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Merhaba,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Onopo Store ailesine hoş geldiniz! 🎉</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Sizlere en kaliteli ürünleri sunmak için buradayız. Sitemizde binlerce ürün arasından seçim yapabilir, özel indirimlerden yararlanabilirsiniz.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://onopostore.com/products" style="display: inline-block; background: linear-gradient(135deg, #1e293b 0%, #475569 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Alışverişe Başla →</a>
        </div>
        
        <p style="font-size: 14px; color: #64748b;">Herhangi bir sorunuz olursa bize ulaşmaktan çekinmeyin.</p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Onopo Store Ekibi</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">© 2026 Onopo Store. Tüm hakları saklıdır.</p>
    </div>
</div>`
    },
    {
        id: 'promo',
        name: 'Promosyon / İndirim',
        subject: '🔥 Özel İndirim Fırsatı - Kaçırmayın!',
        message: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <!-- Header with gradient -->
    <div style="background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="{{LOGO_URL}}" alt="Onopo Store" style="height: 40px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 28px; font-weight: 700;">🔥 ÖZEL İNDİRİM</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; background: #ffffff; text-align: center;">
        <p style="font-size: 18px; color: #334155;">Değerli Müşterimiz,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Sizin için özel bir indirim hazırladık!</p>
        
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); padding: 20px; border-radius: 12px; margin: 25px 0; border: 2px dashed #f59e0b;">
            <p style="font-size: 14px; color: #92400e; margin: 0 0 10px 0;">İNDİRİM KODUNUZ</p>
            <p style="font-size: 32px; font-weight: 700; color: #dc2626; margin: 0; letter-spacing: 4px;">OZEL20</p>
            <p style="font-size: 24px; font-weight: 700; color: #334155; margin: 10px 0 0 0;">%20 İNDİRİM</p>
        </div>
        
        <p style="font-size: 14px; color: #64748b;">Bu kod tüm ürünlerde geçerlidir ve 7 gün süreyle aktiftir.</p>
        
        <div style="margin: 30px 0;">
            <a href="https://onopostore.com/products" style="display: inline-block; background: linear-gradient(135deg, #dc2626 0%, #f97316 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px;">ALIŞVERİŞE BAŞLA →</a>
        </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">İyi alışverişler! • <strong>Onopo Store</strong></p>
    </div>
</div>`
    },
    {
        id: 'order_update',
        name: 'Sipariş Güncellemesi',
        subject: '📦 Siparişiniz Hakkında Bilgilendirme',
        message: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="{{LOGO_URL}}" alt="Onopo Store" style="height: 40px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px; font-weight: 600;">📦 Sipariş Güncellemesi</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; background: #ffffff;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Merhaba,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Siparişiniz ile ilgili bir güncelleme var:</p>
        
        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0284c7;">
            <p style="font-size: 16px; color: #0c4a6e; margin: 0;">[Buraya güncelleme detaylarını yazın]</p>
        </div>
        
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Siparişinizi takip etmek için hesabınıza giriş yapabilirsiniz.</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://onopostore.com/orders" style="display: inline-block; background: #0284c7; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Siparişi Takip Et</a>
        </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;">Saygılarımızla, <strong>Onopo Store</strong></p>
    </div>
</div>`
    },
    {
        id: 'newsletter',
        name: 'Bülten / Haber',
        subject: '📰 Onopo Store\'dan Haberler',
        message: `<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="{{LOGO_URL}}" alt="Onopo Store" style="height: 40px; filter: brightness(0) invert(1);" onerror="this.style.display='none'">
        <h1 style="color: #ffffff; margin: 15px 0 0 0; font-size: 24px; font-weight: 600;">📰 Bu Haftanın Haberleri</h1>
    </div>
    
    <!-- Content -->
    <div style="padding: 30px; background: #ffffff;">
        <p style="font-size: 16px; color: #334155; margin-bottom: 20px;">Merhaba,</p>
        <p style="font-size: 16px; color: #334155; line-height: 1.6;">Bu hafta sizin için hazırladığımız yenilikler:</p>
        
        <div style="margin: 25px 0;">
            <div style="display: flex; align-items: center; padding: 12px; background: #faf5ff; border-radius: 8px; margin-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 12px;">✨</span>
                <span style="color: #334155;">Yeni ürünler eklendi</span>
            </div>
            <div style="display: flex; align-items: center; padding: 12px; background: #faf5ff; border-radius: 8px; margin-bottom: 10px;">
                <span style="font-size: 20px; margin-right: 12px;">🎁</span>
                <span style="color: #334155;">Özel kampanyalar başladı</span>
            </div>
            <div style="display: flex; align-items: center; padding: 12px; background: #faf5ff; border-radius: 8px;">
                <span style="font-size: 20px; margin-right: 12px;">🚚</span>
                <span style="color: #334155;">Ücretsiz kargo fırsatları</span>
            </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://onopostore.com" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #a855f7 100%); color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600;">Sitemizi Ziyaret Edin →</a>
        </div>
    </div>
    
    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; font-size: 14px; color: #64748b;"><strong>Onopo Store</strong></p>
        <p style="margin: 10px 0 0 0; font-size: 12px; color: #94a3b8;">Bu e-postayı almak istemiyorsanız ayarlarınızı güncelleyebilirsiniz.</p>
    </div>
</div>`
    }
]

export default function AdminEmailPage() {
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState('')
    const [error, setError] = React.useState('')

    // Users for recipient selection
    const [allUsers, setAllUsers] = React.useState<any[]>([])
    const [loadingUsers, setLoadingUsers] = React.useState(false)
    const [showRecipientModal, setShowRecipientModal] = React.useState(false)
    const [selectedEmails, setSelectedEmails] = React.useState<string[]>([])
    const [manualEmails, setManualEmails] = React.useState<string[]>([])
    const [newManualEmail, setNewManualEmail] = React.useState('')

    const [recipientType, setRecipientType] = React.useState<'single' | 'all' | 'selected' | 'manual'>('single')
    const [formData, setFormData] = React.useState({
        email: '',
        subject: '',
        message: ''
    })

    // Site settings for logo
    const [siteSettings, setSiteSettings] = React.useState<{ logo_url?: string }>({})

    // Fetch site settings for logo
    React.useEffect(() => {
        fetch('/api/site-settings')
            .then(res => res.json())
            .then(data => setSiteSettings(data))
            .catch(() => { })
    }, [])

    // Fetch users when needed
    React.useEffect(() => {
        if (recipientType === 'all' || recipientType === 'selected') {
            setLoadingUsers(true)
            fetch('/api/admin/users')
                .then(res => res.json())
                .then(data => {
                    if (data.users) setAllUsers(data.users)
                })
                .catch(console.error)
                .finally(() => setLoadingUsers(false))
        }
    }, [recipientType])

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            let emails: string[] = []

            if (recipientType === 'single') {
                emails = [formData.email]
            } else if (recipientType === 'all') {
                emails = allUsers.map(u => u.email)
            } else if (recipientType === 'selected') {
                emails = selectedEmails
            } else if (recipientType === 'manual') {
                emails = manualEmails
            }

            if (emails.length === 0) {
                throw new Error('En az bir alıcı seçmelisiniz')
            }

            const res = await fetch('/api/admin/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: recipientType === 'single' ? formData.email : undefined,
                    emails,
                    subject: formData.subject,
                    message: formData.message,
                    recipientType
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gönderim başarısız')

            setSuccess(`E-posta ${emails.length} kişiye başarıyla gönderildi!`)
            setFormData({ email: '', subject: '', message: '' })
            setSelectedEmails([])
            setManualEmails([])

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const applyTemplate = (template: typeof EMAIL_TEMPLATES[0]) => {
        // Replace logo placeholder with actual logo URL from settings
        const logoUrl = siteSettings.logo_url || 'https://onopostore.com/logo.png'
        const messageWithLogo = template.message.replace(/\{\{LOGO_URL\}\}/g, logoUrl)

        setFormData({
            ...formData,
            subject: template.subject,
            message: messageWithLogo
        })
    }

    const addManualEmail = () => {
        if (newManualEmail && !manualEmails.includes(newManualEmail)) {
            setManualEmails([...manualEmails, newManualEmail])
            setNewManualEmail('')
        }
    }

    const removeManualEmail = (email: string) => {
        setManualEmails(manualEmails.filter(e => e !== email))
    }

    const toggleUserSelection = (email: string) => {
        if (selectedEmails.includes(email)) {
            setSelectedEmails(selectedEmails.filter(e => e !== email))
        } else {
            setSelectedEmails([...selectedEmails, email])
        }
    }

    const selectAllUsers = () => {
        setSelectedEmails(allUsers.map(u => u.email))
    }

    const deselectAllUsers = () => {
        setSelectedEmails([])
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Mail className="w-6 h-6 text-slate-700" />
                E-posta Gönderimi
            </h1>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <form onSubmit={handleSend} className="space-y-6">
                    {/* Recipient Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700">Alıcı Seçimi</label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                            <button
                                type="button"
                                onClick={() => setRecipientType('single')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all text-center ${recipientType === 'single'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <User className="w-5 h-5" />
                                <div className="font-semibold text-sm">Tek Kullanıcı</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipientType('all')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all text-center ${recipientType === 'all'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <Users className="w-5 h-5" />
                                <div className="font-semibold text-sm">Tüm Kullanıcılar</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipientType('selected')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all text-center ${recipientType === 'selected'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <CheckCircle className="w-5 h-5" />
                                <div className="font-semibold text-sm">DB'den Seç</div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipientType('manual')}
                                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all text-center ${recipientType === 'manual'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <Plus className="w-5 h-5" />
                                <div className="font-semibold text-sm">Manuel Giriş</div>
                            </button>
                        </div>
                    </div>

                    {/* Email Address (Only for single) */}
                    {recipientType === 'single' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Alıcı E-posta Adresi
                            </label>
                            <Input
                                type="email"
                                required
                                placeholder="ornek@mail.com"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        </div>
                    )}

                    {/* All Users Info */}
                    {recipientType === 'all' && (
                        <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-semibold text-blue-800">Tüm Kullanıcılara Gönderilecek</p>
                                    <p className="text-sm text-blue-600">
                                        {loadingUsers ? 'Yükleniyor...' : `Toplam ${allUsers.length} kullanıcı`}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRecipientModal(true)}
                                    className="gap-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    Listeyi Gör
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Selected Users */}
                    {recipientType === 'selected' && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-sm font-medium text-slate-700">
                                    Veritabanından Seç ({selectedEmails.length} seçili)
                                </label>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" size="sm" onClick={selectAllUsers}>
                                        Tümünü Seç
                                    </Button>
                                    <Button type="button" variant="outline" size="sm" onClick={deselectAllUsers}>
                                        Temizle
                                    </Button>
                                </div>
                            </div>
                            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
                                {loadingUsers ? (
                                    <p className="text-sm text-slate-500 p-2">Yükleniyor...</p>
                                ) : allUsers.length === 0 ? (
                                    <p className="text-sm text-slate-500 p-2">Kullanıcı bulunamadı</p>
                                ) : (
                                    allUsers.map(user => (
                                        <label
                                            key={user.id}
                                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 cursor-pointer"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedEmails.includes(user.email)}
                                                onChange={() => toggleUserSelection(user.email)}
                                                className="rounded"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-slate-900 truncate">{user.full_name || 'İsimsiz'}</p>
                                                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {/* Manual Email Entry */}
                    {recipientType === 'manual' && (
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-slate-700">
                                E-posta Adresleri ({manualEmails.length} adet)
                            </label>
                            <div className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="ornek@mail.com"
                                    value={newManualEmail}
                                    onChange={e => setNewManualEmail(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addManualEmail())}
                                />
                                <Button type="button" onClick={addManualEmail} className="shrink-0">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                            {manualEmails.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {manualEmails.map(email => (
                                        <span
                                            key={email}
                                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                                        >
                                            {email}
                                            <button
                                                type="button"
                                                onClick={() => removeManualEmail(email)}
                                                className="hover:text-red-500"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Templates */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Şablonlar
                        </label>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                            {EMAIL_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => applyTemplate(template)}
                                    className="p-3 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
                                >
                                    <div className="font-medium text-sm text-slate-800">{template.name}</div>
                                    <div className="text-xs text-slate-500 truncate">{template.subject}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Subject */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Konu Başlığı
                        </label>
                        <Input
                            required
                            placeholder="E-posta konusu..."
                            value={formData.subject}
                            onChange={e => setFormData({ ...formData, subject: e.target.value })}
                        />
                    </div>

                    {/* Message */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Mesaj İçeriği (HTML destekler)
                        </label>
                        <textarea
                            required
                            rows={10}
                            className="w-full p-3 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono text-sm"
                            placeholder="<p>Merhaba,</p><p>Mesajınız...</p>"
                            value={formData.message}
                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                        />
                        <p className="text-xs text-slate-500 mt-2">
                            HTML etiketleri kullanabilirsiniz (ör: &lt;b&gt;kalın&lt;/b&gt;, &lt;br&gt;).
                        </p>
                    </div>

                    {/* Status Messages */}
                    {error && (
                        <div className="p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-5 h-5" />
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="p-4 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
                            <CheckCircle className="w-5 h-5" />
                            {success}
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="pt-4">
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 text-lg bg-slate-900 hover:bg-slate-800 gap-2"
                        >
                            <Send className="w-5 h-5" />
                            {loading ? 'Gönderiliyor...' : 'E-postayı Gönder'}
                        </Button>
                    </div>
                </form>
            </div>

            {/* Recipient List Modal */}
            {showRecipientModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowRecipientModal(false)}>
                    <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                            <h3 className="font-bold text-lg">Alıcı Listesi ({allUsers.length} kullanıcı)</h3>
                            <button onClick={() => setShowRecipientModal(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                                ✕
                            </button>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto">
                            {allUsers.length === 0 ? (
                                <p className="text-slate-500 text-center py-8">Kullanıcı bulunamadı</p>
                            ) : (
                                <div className="space-y-2">
                                    {allUsers.map(user => (
                                        <div key={user.id} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                                                {user.email?.[0]?.toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-slate-900 truncate">{user.full_name || 'İsimsiz'}</p>
                                                <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
