'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag } from 'lucide-react'
import { Suspense } from 'react'

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const redirectData = searchParams.get('redirect')

    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    // 2FA State
    const [requires2FA, setRequires2FA] = React.useState(false)
    const [userId, setUserId] = React.useState<number | null>(null)
    const [code, setCode] = React.useState('')
    const [emailHint, setEmailHint] = React.useState('')
    const [countdown, setCountdown] = React.useState(60)

    // Countdown timer for 2FA
    React.useEffect(() => {
        if (!requires2FA) return

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(timer)
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [requires2FA])

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

            // Check if 2FA is required
            if (data.requires2FA) {
                setRequires2FA(true)
                setUserId(data.userId)
                setEmailHint(data.emailHint)
                setCountdown(60)
                return
            }

            // Success - direct login (non-admin)
            window.location.href = redirectData || '/'

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handle2FASubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/auth/verify-2fa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, code }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Doğrulama başarısız')
            }

            // Success
            window.location.href = redirectData || '/'

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleResendCode = async () => {
        setLoading(true)
        setError('')
        setCode('')

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Kod gönderilemedi')
            }

            if (data.requires2FA) {
                setUserId(data.userId)
                setEmailHint(data.emailHint)
                setCountdown(60)
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // 2FA Code Entry Screen
    if (requires2FA) {
        return (
            <div className="min-h-screen grid lg:grid-cols-2">
                <div className="flex items-center justify-center p-8 bg-white">
                    <div className="w-full max-w-md space-y-8">
                        <div className="text-center">
                            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white mb-6">
                                🔐
                            </div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                                Doğrulama Kodu
                            </h1>
                            <p className="mt-2 text-slate-600">
                                <strong>{emailHint}</strong> adresine gönderilen 6 haneli kodu girin
                            </p>
                        </div>

                        <form onSubmit={handle2FASubmit} className="space-y-6">
                            {error && (
                                <div className="p-4 rounded-lg bg-red-50 text-red-600 text-sm font-medium">
                                    {error}
                                </div>
                            )}

                            <div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength={6}
                                    required
                                    value={code}
                                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="w-full px-4 py-4 text-center text-3xl tracking-[0.5em] font-bold rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    placeholder="000000"
                                    autoFocus
                                />
                            </div>

                            <div className="text-center">
                                {countdown > 0 ? (
                                    <p className="text-slate-500">
                                        Kod <span className="font-bold text-slate-900">{countdown}</span> saniye içinde geçersiz olacak
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-red-500 font-medium">Kodun süresi doldu</p>
                                        <button
                                            type="button"
                                            onClick={handleResendCode}
                                            disabled={loading}
                                            className="text-slate-900 font-semibold hover:underline"
                                        >
                                            Yeni kod gönder
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <Button
                                    type="submit"
                                    disabled={loading || code.length !== 6 || countdown === 0}
                                    className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base"
                                >
                                    {loading ? 'Doğrulanıyor...' : 'Doğrula'}
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setRequires2FA(false)
                                        setCode('')
                                        setError('')
                                    }}
                                    className="w-full h-12 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-semibold text-base"
                                >
                                    Geri Dön
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Right: Security Feature */}
                <div className="hidden lg:block bg-slate-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
                    <div className="absolute inset-0 flex items-center justify-center p-12">
                        <div className="text-white max-w-lg space-y-6 relative z-10 p-12">
                            <h2 className="text-4xl font-bold leading-tight">
                                İki Faktörlü Doğrulama
                            </h2>
                            <p className="text-slate-300 text-lg">
                                Hesabınızın güvenliği için e-posta ile doğrulama kodu gönderdik.
                            </p>
                            <ul className="space-y-4 text-slate-300">
                                <li className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-400" />
                                    Ekstra güvenlik katmanı
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-400" />
                                    60 saniyelik geçerlilik
                                </li>
                                <li className="flex items-center gap-3">
                                    <div className="h-2 w-2 rounded-full bg-green-400" />
                                    Yetkisiz erişime karşı koruma
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        )
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

                        <div className="space-y-4">
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base"
                            >
                                {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                            </Button>
                            <a href="/register" className="block">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full h-12 border-slate-200 text-slate-900 hover:bg-slate-50 rounded-xl font-semibold text-base"
                                >
                                    Kayıt Ol
                                </Button>
                            </a>
                        </div>
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

export default function LoginPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Yükleniyor...</div>}>
            <LoginForm />
        </Suspense>
    )
}
