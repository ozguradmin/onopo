'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button, buttonClasses } from '@/components/ui/button'
import { LogIn, ShieldCheck } from 'lucide-react'
import { Suspense } from 'react'
import { safeRedirectPath } from '@/lib/safeRedirect'
import { AuthShell } from '@/components/account/AuthShell'
import { Field, FormAlert, inputClass } from '@/components/forms/Field'
import { PasswordInput } from '@/components/forms/PasswordInput'
import { Skeleton } from '@/components/ui/Skeleton'
import { useSiteSettings } from '@/components/layout/store-data'
import { cn } from '@/lib/utils'

// Admin 2FA codes are valid for 5 minutes (app/api/auth/login/route.ts)
const CODE_VALID_SECONDS = 300

/** 300 → "5:00" */
function formatCountdown(seconds: number): string {
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function LoginForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    // Only same-origin relative paths: no open redirect or javascript: URL after login
    const redirectData = safeRedirectPath(searchParams.get('redirect'))

    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    // 2FA State
    const [requires2FA, setRequires2FA] = React.useState(false)
    const [userId, setUserId] = React.useState<number | null>(null)
    const [code, setCode] = React.useState('')
    const [emailHint, setEmailHint] = React.useState('')
    const [countdown, setCountdown] = React.useState(CODE_VALID_SECONDS)

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
                setCountdown(CODE_VALID_SECONDS)
                return
            }

            // Success - direct login (non-admin)
            window.location.href = redirectData

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
            window.location.href = redirectData

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
                setCountdown(CODE_VALID_SECONDS)
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const settings = useSiteSettings()
    const registerHref = redirectData !== '/' ? `/register/?redirect=${encodeURIComponent(redirectData)}` : '/register/'

    // 2FA Code Entry Screen
    if (requires2FA) {
        return (
            <AuthShell
                icon={<ShieldCheck />}
                title="Doğrulama kodu"
                subtitle={
                    <>
                        <strong className="font-semibold text-ink-2">{emailHint}</strong> adresine gönderilen 6 haneli kodu gir.
                    </>
                }
                panelTitle="Hesabın iki adımlı doğrulamayla korunuyor"
            >
                <form onSubmit={handle2FASubmit} className="space-y-5">
                    {error && <FormAlert>{error}</FormAlert>}

                    <Field id="login-code" label="Doğrulama kodu">
                        <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            required
                            value={code}
                            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            autoComplete="one-time-code"
                            className={cn(inputClass, 'h-16 text-center text-[28px] font-bold tracking-[0.5em] tabular placeholder:tracking-[0.5em]')}
                            placeholder="000000"
                            autoFocus
                        />
                    </Field>

                    <div className="text-center text-sm">
                        {countdown > 0 ? (
                            <p className="text-muted">
                                Kodun geçerlilik süresi: <span className="font-bold text-ink tabular">{formatCountdown(countdown)}</span>
                            </p>
                        ) : (
                            <div className="space-y-1" role="status">
                                <p className="font-semibold text-danger">Kodun süresi doldu</p>
                                <button
                                    type="button"
                                    onClick={handleResendCode}
                                    disabled={loading}
                                    className="inline-flex min-h-11 items-center px-2 font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline disabled:opacity-50"
                                >
                                    Yeni kod gönder
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3">
                        <Button
                            type="submit"
                            variant="brand"
                            size="48"
                            fullWidth
                            isLoading={loading}
                            disabled={loading || code.length !== 6 || countdown === 0}
                        >
                            {loading ? 'Doğrulanıyor...' : 'Doğrula'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline-ink"
                            size="48"
                            fullWidth
                            onClick={() => {
                                setRequires2FA(false)
                                setCode('')
                                setError('')
                            }}
                        >
                            Geri dön
                        </Button>
                    </div>
                </form>
            </AuthShell>
        )
    }

    return (
        <AuthShell
            icon={<LogIn />}
            title="Giriş yap"
            subtitle={
                <>
                    Hesabın yok mu?{' '}
                    <Link href={registerHref} className="font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline">
                        Ücretsiz üye ol
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && <FormAlert>{error}</FormAlert>}

                <Field id="login-email" label="E-posta">
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        autoComplete="email"
                        inputMode="email"
                        className={inputClass}
                        placeholder="ornek@eposta.com"
                    />
                </Field>
                <Field id="login-password" label="Şifre">
                    <PasswordInput
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="current-password"
                        placeholder="Şifren"
                    />
                </Field>

                <Button type="submit" variant="brand" size="48" fullWidth isLoading={loading} disabled={loading}>
                    {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
                </Button>

                <div className="flex items-center gap-3 text-[13px] text-subtle" aria-hidden="true">
                    <span className="h-px flex-1 bg-line" />
                    veya
                    <span className="h-px flex-1 bg-line" />
                </div>

                <Link href={registerHref} className={buttonClasses({ variant: 'outline-ink', size: '48', fullWidth: true })}>
                    Yeni hesap oluştur
                </Link>

                {settings.footer_email && (
                    <p className="text-center text-[13px] leading-5 text-muted">
                        Şifreni mi unuttun?{' '}
                        <a href={`mailto:${settings.footer_email}`} className="font-semibold text-ink-2 underline-offset-4 hover:underline">
                            {settings.footer_email}
                        </a>{' '}
                        adresine yaz, yardımcı olalım.
                    </p>
                )}
            </form>
        </AuthShell>
    )
}

function LoginFallback() {
    return (
        <div className="min-h-[60vh] bg-surface py-6 sm:py-10 lg:py-16" role="status" aria-label="Giriş sayfası yükleniyor">
            <div className="container-store">
                <div className="mx-auto max-w-[1040px] rounded-sheet border border-line bg-white px-5 py-7 sm:px-10 sm:py-10 lg:px-14 lg:py-14">
                    <div className="max-w-[400px] space-y-5">
                        <Skeleton className="h-12 w-12 rounded-card" />
                        <Skeleton className="h-8 w-40" />
                        <Skeleton className="h-12 w-full rounded-[10px]" />
                        <Skeleton className="h-12 w-full rounded-[10px]" />
                        <Skeleton className="h-12 w-full rounded-card" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function LoginPage() {
    return (
        <Suspense fallback={<LoginFallback />}>
            <LoginForm />
        </Suspense>
    )
}
