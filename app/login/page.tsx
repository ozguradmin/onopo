'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, ArrowRight } from 'lucide-react'

export default function LoginPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectData = searchParams.get('redirect')

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

            // Success
            if (redirectData) {
                router.push(redirectData)
            } else {
                router.push('/')
            }
            router.refresh()

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen grid lg:grid-cols-2">
            {/* Left: Form */}
            <div className="flex items-center justify-center p-8 bg-white">
                <div className="w-full max-w-md space-y-8">
                    <div className="text-center">
                        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white mb-6">
                            <ShoppingBag className="h-6 w-6" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                            Tekrar Hoşgeldiniz
                        </h1>
                        <p className="mt-2 text-slate-600">
                            Hesabınıza giriş yapın veya{' '}
                            <a href="/register" className="font-semibold text-slate-900 hover:underline">
                                ücretsiz kayıt olun
                            </a>
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {error && (
                            <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    placeholder="ornek@email.com"
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
                            className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base"
                        >
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right: Feature/Image */}
            <div className="hidden lg:block bg-slate-900 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
                <div className="absolute inset-0 flex items-center justify-center p-12">
                    <div className="text-white max-w-lg space-y-6 relative z-10 p-12 ">
                        <h2 className="text-4xl font-bold leading-tight">
                            Premium Alışveriş Deneyimi Sizi Bekliyor
                        </h2>
                        <ul className="space-y-4 text-slate-300">
                            <li className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-white" />
                                Özel koleksiyonlara erken erişim
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-white" />
                                Hızlı ve güvenli ödeme
                            </li>
                            <li className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-white" />
                                7/24 Müşteri desteği
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    )
}
