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

    // Form states
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [confirmPassword, setConfirmPassword] = React.useState('')

    React.useEffect(() => {
        fetch('/api/auth/me')
            .then(res => res.json())
            .then(data => {
                if (data.user) {
                    setUser(data.user)
                    setEmail(data.user.email)
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (password && password !== confirmPassword) {
            alert('Şifreler uyuşmuyor')
            return
        }

        setSaving(true)
        try {
            const res = await fetch('/api/admin/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: password || undefined })
            })

            if (res.ok) {
                alert('Profil güncellendi')
                setPassword('')
                setConfirmPassword('')
            } else {
                throw new Error('Güncelleme başarısız')
            }
        } catch (error) {
            alert('Hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Yükleniyor...</div>

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-6 flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold">Admin Profil Ayarları</h1>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
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
                        <h3 className="font-semibold mb-4">Şifre Değiştir</h3>
                        <div className="grid gap-4">
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

                    <Button type="submit" disabled={saving} className="w-full bg-slate-900 text-white hover:bg-slate-800 h-11">
                        {saving ? 'Kaydediliyor...' : 'Admin Profilini Güncelle'}
                    </Button>
                </form>
            </div>
        </div>
    )
}
