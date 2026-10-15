'use client'

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { KeyRound } from 'lucide-react'

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const token = searchParams.get('token') || ''

    const [password, setPassword] = React.useState('')
    const [confirm, setConfirm] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [done, setDone] = React.useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        if (password !== confirm) {
            setError('Şifreler eşleşmiyor')
            return
        }

        setLoading(true)
        try {
            const res = await fetch('/api/admin/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, password }),
            })
            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || 'Şifre güncellenemedi')
            }
            setDone(true)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
            <div className="w-full max-w-md">
                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <div className="text-center mb-8">
                        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 text-white mb-6">
                            <KeyRound className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Yeni Şifre Belirle
                        </h1>
                    </div>

                    {done ? (
                        <div className="space-y-6">
                            <div className="p-4 rounded-lg bg-green-50 text-green-700 text-sm font-medium border border-green-100">
                                Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.
                            </div>
                            <a href="/admin/login" className="block">
                                <Button className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base">
                                    Giriş Sayfasına Git
                                </Button>
                            </a>
                        </div>
                    ) : !token ? (
                        <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                            Geçersiz bağlantı. Giriş sayfasından yeni bir sıfırlama bağlantısı isteyin.
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                        placeholder="En az 8 karakter"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Yeni Şifre (Tekrar)</label>
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base"
                            >
                                {loading ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
                            </Button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function AdminResetPasswordPage() {
    return (
        <React.Suspense fallback={null}>
            <ResetPasswordForm />
        </React.Suspense>
    )
}
