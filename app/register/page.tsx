'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/components/account/AuthShell'
import { Field, FormAlert, inputClass, textareaClass } from '@/components/forms/Field'
import { PasswordInput } from '@/components/forms/PasswordInput'
import { safeRedirectPath } from '@/lib/safeRedirect'
import { cn } from '@/lib/utils'

function RegisterForm() {
    const router = useRouter()
    const searchParams = useSearchParams()
    // Where to go after the automatic login (e.g. back to the checkout); same validation as /login
    const redirectTo = safeRedirectPath(searchParams.get('redirect'))

    const [name, setName] = React.useState('')
    const [email, setEmail] = React.useState('')
    const [phone, setPhone] = React.useState('')
    const [address, setAddress] = React.useState('')
    const [city, setCity] = React.useState('')
    const [district, setDistrict] = React.useState('')
    const [postalCode, setPostalCode] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [showAddress, setShowAddress] = React.useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            // Register
            const registerRes = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    email,
                    phone,
                    address,
                    city,
                    district,
                    postal_code: postalCode,
                    password
                }),
            })

            const registerData = await registerRes.json()

            if (!registerRes.ok) {
                throw new Error(registerData.error || 'Kayıt başarısız')
            }

            // Auto-login after successful registration
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            })

            if (loginRes.ok) {
                router.push(redirectTo)
                router.refresh()
            } else {
                // If auto-login fails, redirect to login page
                router.push('/login')
            }

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    const loginHref = redirectTo !== '/' ? `/login/?redirect=${encodeURIComponent(redirectTo)}` : '/login/'

    return (
        <AuthShell
            icon={<UserPlus />}
            title="Üye ol"
            subtitle={
                <>
                    Zaten hesabın var mı?{' '}
                    <Link href={loginHref} className="font-semibold text-brand-600 underline-offset-4 hover:text-brand-700 hover:underline">
                        Giriş yap
                    </Link>
                </>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && <FormAlert>{error}</FormAlert>}

                <Field id="register-name" label="Ad soyad" required>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={e => setName(e.target.value)}
                        autoComplete="name"
                        className={inputClass}
                        placeholder="Adın ve soyadın"
                    />
                </Field>
                <Field id="register-email" label="E-posta" required>
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
                <Field id="register-phone" label="Telefon" required>
                    <input
                        type="tel"
                        required
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        autoComplete="tel"
                        className={inputClass}
                        placeholder="05XX XXX XX XX"
                    />
                </Field>
                <Field id="register-password" label="Şifre" required hint="En az 6 karakter.">
                    <PasswordInput
                        required
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="Bir şifre belirle"
                        minLength={6}
                    />
                </Field>

                <div className="rounded-card border border-line">
                    <button
                        type="button"
                        onClick={() => setShowAddress(open => !open)}
                        aria-expanded={showAddress}
                        aria-controls="register-address-fields"
                        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-card px-3.5 text-left text-sm font-semibold text-ink-2"
                    >
                        <span>
                            Teslimat adresini şimdi ekle <span className="font-normal text-muted">(isteğe bağlı)</span>
                        </span>
                        <ChevronDown className={cn('h-5 w-5 shrink-0 text-muted transition-transform duration-200', showAddress && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {showAddress && (
                        <div id="register-address-fields" className="space-y-4 border-t border-line p-3.5">
                            <Field id="register-address" label="Adres">
                                <textarea
                                    value={address}
                                    onChange={e => setAddress(e.target.value)}
                                    autoComplete="street-address"
                                    className={textareaClass}
                                    placeholder="Mahalle, sokak, bina no, daire no"
                                    rows={2}
                                />
                            </Field>
                            <div className="grid grid-cols-2 gap-3">
                                <Field id="register-city" label="İl">
                                    <input
                                        type="text"
                                        value={city}
                                        onChange={e => setCity(e.target.value)}
                                        autoComplete="address-level1"
                                        className={inputClass}
                                        placeholder="örn. İstanbul"
                                    />
                                </Field>
                                <Field id="register-district" label="İlçe">
                                    <input
                                        type="text"
                                        value={district}
                                        onChange={e => setDistrict(e.target.value)}
                                        autoComplete="address-level2"
                                        className={inputClass}
                                        placeholder="örn. Kadıköy"
                                    />
                                </Field>
                            </div>
                            <Field id="register-postalCode" label="Posta kodu">
                                <input
                                    type="text"
                                    value={postalCode}
                                    onChange={e => setPostalCode(e.target.value)}
                                    autoComplete="postal-code"
                                    inputMode="numeric"
                                    className={inputClass}
                                    placeholder="örn. 34000"
                                />
                            </Field>
                        </div>
                    )}
                </div>

                <Button type="submit" variant="brand" size="48" fullWidth isLoading={loading} disabled={loading}>
                    {loading ? 'Hesap oluşturuluyor...' : 'Hesap oluştur'}
                </Button>

                <p className="text-center text-[13px] leading-5 text-muted">
                    Hesap oluşturarak{' '}
                    <Link href="/page/terms/" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
                        Kullanım Koşulları
                    </Link>{' '}
                    ve{' '}
                    <Link href="/page/policy/" className="font-medium text-ink-2 underline underline-offset-2 hover:text-ink">
                        Gizlilik Politikası
                    </Link>
                    &apos;nı okuduğunu kabul edersin.
                </p>
            </form>
        </AuthShell>
    )
}

export default function RegisterPage() {
    return (
        <React.Suspense fallback={<div className="min-h-[70vh] bg-surface" />}>
            <RegisterForm />
        </React.Suspense>
    )
}
