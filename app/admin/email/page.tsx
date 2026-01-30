'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Mail, Send, Users, User, CheckCircle, AlertCircle } from 'lucide-react'

export default function AdminEmailPage() {
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState('')
    const [error, setError] = React.useState('')

    const [recipientType, setRecipientType] = React.useState<'single' | 'all'>('single')
    const [formData, setFormData] = React.useState({
        email: '',
        subject: '',
        message: ''
    })

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/admin/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    recipientType
                })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Gönderim başarısız')

            setSuccess('E-posta başarıyla gönderildi!')
            setFormData({ ...formData, subject: '', message: '' }) // Keep email if single needed again? maybe clear all
            if (recipientType === 'single') setFormData(prev => ({ ...prev, email: '', subject: '', message: '' }))
            else setFormData(prev => ({ ...prev, subject: '', message: '' }))

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
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
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={() => setRecipientType('single')}
                                className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${recipientType === 'single'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <User className="w-5 h-5" />
                                <div className="text-left">
                                    <div className="font-semibold">Tek Kullanıcı</div>
                                    <div className="text-xs opacity-75">Belirli bir adrese gönder</div>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRecipientType('all')}
                                className={`flex-1 p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${recipientType === 'all'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    }`}
                            >
                                <Users className="w-5 h-5" />
                                <div className="text-left">
                                    <div className="font-semibold">Tüm Kullanıcılar</div>
                                    <div className="text-xs opacity-75">Veritabanındaki herkese gönder</div>
                                </div>
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
                            rows={8}
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
        </div>
    )
}
