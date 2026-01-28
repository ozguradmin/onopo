'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Check } from 'lucide-react'

export default function RegisterPage() {
    const router = useRouter()

    const [name, setName] = React.useState('')
    const [email, setEmail] = React.useState('')
    const [password, setPassword] = React.useState('')
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError('')

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.error || 'Kayıt başarısız')
            }

            // Success - Redirect to login
            router.push('/login')

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
                            Aramıza Katılın
                        </h1>
                        <p className="mt-2 text-slate-600">
                            Zaten hesabınız var mı?{' '}
                            <a href="/login" className="font-semibold text-slate-900 hover:underline">
                                Giriş yapın
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
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ad Soyad</label>
                                <input
                                    type="text"
                                    required
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all"
                                    placeholder="Adınız Soyadınız"
                                />
                            </div>
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
                                    placeholder="En az 6 karakter"
                                    minLength={6}
                                />
                            </div>
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-12 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-semibold text-base"
                        >
                            {loading ? 'Kayıt Olunuyor...' : 'Hesap Oluştur'}
                        </Button>
                    </form>
                </div>
            </div>

            {/* Right: Feature/Image */}
            <div className="hidden lg:block bg-slate-50 relative overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center p-12">
                    <div className="grid grid-cols-2 gap-4 max-w-lg opacity-50">
                        {/* Abstract decorative grid */}
                        <div className="aspect-square rounded-2xl bg-slate-200 animate-pulse" />
                        <div className="aspect-square rounded-2xl bg-slate-300" />
                        <div className="aspect-square rounded-2xl bg-slate-300" />
                        <div className="aspect-square rounded-2xl bg-slate-200 animate-pulse" style={{ animationDelay: '500ms' }} />
                    </div>
                </div>
                <div className="absolute bottom-12 left-12 right-12">
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                                <Check className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900">Üyelere Özel Fırsatlar</div>
                                <div className="text-sm text-slate-500">İlk siparişinize özel indirimler</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
