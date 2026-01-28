'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Shield, Lock } from 'lucide-react'

export default function AdminLoginPage() {
    const router = useRouter()

    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Giriş başarısız')
            }

            // Check if user is admin
            const meRes = await fetch('/api/auth/me')
            if (meRes.ok) {
                const meData = await meRes.json()
                if (meData.user?.role === 'admin') {
                    router.push('/admin')
                    router.refresh()
                } else {
                    setError('Bu hesap admin yetkisine sahip değil.')
                }
            }

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
                            <Shield className="h-8 w-8" />
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                            Admin Paneli
                        </h1>
                        <p className="mt-2 text-slate-500 text-sm">
                            Yönetici hesabınızla giriş yapın
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Admin Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    placeholder="admin@onopo.com"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base gap-2"
                        >
                            <Lock className="w-4 h-4" />
                            {loading ? 'Giriş Yapılıyor...' : 'Admin Girişi'}
                        </Button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-100 text-center">
                        <a href="/" className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
                            ← Mağazaya Dön
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
