'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Send, Users, User, CheckCircle, AlertCircle, Eye, Plus, Trash2, FileText } from 'lucide-react'

// Pre-defined email templates
const EMAIL_TEMPLATES = [
    {
        id: 'welcome',
        name: 'Hoş Geldin',
        subject: 'Onopo Store\'a Hoş Geldiniz!',
        message: `<div style="font-family: Arial, sans-serif;">
    <h2>Merhaba!</h2>
    <p>Onopo Store ailesine hoş geldiniz! 🎉</p>
    <p>Sizlere en kaliteli ürünleri sunmak için buradayız. Sitemizde binlerce ürün arasından seçim yapabilir, özel indirimlerden yararlanabilirsiniz.</p>
    <p>Herhangi bir sorunuz olursa bize ulaşmaktan çekinmeyin.</p>
    <br>
    <p><strong>Onopo Store Ekibi</strong></p>
</div>`
    },
    {
        id: 'promo',
        name: 'Promosyon / İndirim',
        subject: '🔥 Özel İndirim Fırsatı!',
        message: `<div style="font-family: Arial, sans-serif;">
    <h2>Kaçırılmayacak Fırsat! 🔥</h2>
    <p>Değerli müşterimiz,</p>
    <p>Sizin için özel bir indirim hazırladık! <strong>%20 indirim</strong> kodunuz: <code style="background: #f0f0f0; padding: 4px 8px; border-radius: 4px;">OZEL20</code></p>
    <p>Bu kod tüm ürünlerde geçerlidir ve 7 gün süreyle aktiftir.</p>
    <br>
    <p><a href="https://onopostore.com" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Alışverişe Başla</a></p>
    <br>
    <p>İyi alışverişler!<br><strong>Onopo Store</strong></p>
</div>`
    },
    {
        id: 'order_update',
        name: 'Sipariş Güncellemesi',
        subject: 'Siparişiniz Hakkında Bilgilendirme',
        message: `<div style="font-family: Arial, sans-serif;">
    <h2>Sipariş Güncellemesi</h2>
    <p>Merhaba,</p>
    <p>Siparişiniz ile ilgili bir güncelleme var:</p>
    <p>[Buraya güncelleme detaylarını yazın]</p>
    <p>Siparişinizi takip etmek için hesabınıza giriş yapabilirsiniz.</p>
    <br>
    <p>Saygılarımızla,<br><strong>Onopo Store</strong></p>
</div>`
    },
    {
        id: 'newsletter',
        name: 'Bülten / Haber',
        subject: 'Onopo Store\'dan Haberler',
        message: `<div style="font-family: Arial, sans-serif;">
    <h2>Bu Haftanın Haberleri 📰</h2>
    <p>Merhaba,</p>
    <p>Bu hafta sizin için hazırladığımız yenilikler:</p>
    <ul>
        <li>Yeni ürünler eklendi</li>
        <li>Özel kampanyalar başladı</li>
        <li>Ücretsiz kargo fırsatları</li>
    </ul>
    <br>
    <p><a href="https://onopostore.com" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 8px;">Sitemizi Ziyaret Edin</a></p>
    <br>
    <p><strong>Onopo Store</strong></p>
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
        setFormData({
            ...formData,
            subject: template.subject,
            message: template.message
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
