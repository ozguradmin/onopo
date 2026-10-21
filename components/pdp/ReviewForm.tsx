'use client'

/**
 * "Yorum yaz" entry point and form. Uses the existing API unchanged:
 *   GET  /api/auth/me                      (only when the visitor opens the form)
 *   POST /api/products/<id>/reviews        { rating, comment } → 401 / 409 / 200
 * After a successful post the server page is refreshed (router.refresh()), so the list, the star row
 * and the JSON-LD rating show the new review. The anchor #yorum-yaz (star row link, post-login
 * redirect) opens the form.
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button, buttonClasses } from '@/components/ui/button'

type Auth = 'unknown' | 'checking' | 'in' | 'out'

const RATING_LABELS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Çok iyi']
const STAR_PATH = 'M10 1.6l2.47 5.2 5.69.67-4.2 3.9 1.11 5.62L10 14.2l-5.07 2.79 1.11-5.62-4.2-3.9 5.69-.67L10 1.6z'

export function ReviewForm({ productId, hasReviews }: { productId: number; hasReviews: boolean }) {
    const router = useRouter()
    const pathname = usePathname()
    const [open, setOpen] = React.useState(false)
    const [auth, setAuth] = React.useState<Auth>('unknown')
    const [rating, setRating] = React.useState(0)
    const [hover, setHover] = React.useState(0)
    const [comment, setComment] = React.useState('')
    const [error, setError] = React.useState('')
    const [sending, setSending] = React.useState(false)
    const [done, setDone] = React.useState(false)
    const formId = React.useId()
    const ratingErrorId = React.useId()
    const firstFieldRef = React.useRef<HTMLInputElement>(null)

    const authRequested = React.useRef(false)
    const checkAuth = React.useCallback(() => {
        if (authRequested.current) return
        authRequested.current = true
        setAuth('checking')
        fetch('/api/auth/me', { credentials: 'same-origin' })
            .then(r => setAuth(r.ok ? 'in' : 'out'))
            .catch(() => setAuth('out'))
    }, [])

    const openForm = React.useCallback(() => {
        setOpen(true)
        setDone(false)
        checkAuth()
    }, [checkAuth])

    // #yorum-yaz opens the form (star-row link, return from the login page)
    React.useEffect(() => {
        const onHash = () => {
            if (window.location.hash === '#yorum-yaz') openForm()
        }
        onHash()
        window.addEventListener('hashchange', onHash)
        return () => window.removeEventListener('hashchange', onHash)
    }, [openForm])

    React.useEffect(() => {
        if (open && auth === 'in') firstFieldRef.current?.focus({ preventScroll: true })
    }, [open, auth])

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (sending) return
        if (rating < 1) {
            setError('Lütfen 1 ile 5 arasında bir puan seç.')
            return
        }
        setSending(true)
        setError('')
        try {
            const res = await fetch(`/api/products/${productId}/reviews`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating, comment: comment.trim() }),
            })
            if (res.status === 401) {
                setAuth('out')
                return
            }
            if (!res.ok) {
                const data = (await res.json().catch(() => ({}))) as { error?: string }
                setError(res.status === 409 ? 'Bu ürüne daha önce değerlendirme yazdın.' : data.error || 'Değerlendirme gönderilemedi, lütfen tekrar dene.')
                return
            }
            setDone(true)
            setOpen(false)
            setRating(0)
            setComment('')
            // Drop #yorum-yaz so the form does not reopen; then re-render the server page with the new review
            if (window.location.hash === '#yorum-yaz') window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
            router.refresh()
        } catch {
            setError('Bağlantı hatası. Lütfen tekrar dene.')
        } finally {
            setSending(false)
        }
    }

    const loginHref = `/login/?redirect=${encodeURIComponent(`${pathname || '/'}#yorum-yaz`)}`
    const shown = hover || rating

    return (
        <div id="yorum-yaz" className="scroll-mt-28">
            {done && (
                <p role="status" className="mb-3 rounded-card bg-success-50 px-4 py-3 text-sm font-semibold text-success">
                    Teşekkürler! Değerlendirmen yayınlandı.
                </p>
            )}

            {!open ? (
                <Button type="button" variant={hasReviews ? 'outline-ink' : 'brand'} size="44" onClick={openForm} aria-expanded={false} aria-controls={formId} className="w-full sm:w-auto">
                    <PenLine className="h-4 w-4" aria-hidden="true" />
                    {hasReviews ? 'Yorum yaz' : 'İlk yorumu sen yaz'}
                </Button>
            ) : (
                <div id={formId} className="rounded-card border border-line bg-white p-4 sm:p-5">
                    {auth === 'checking' || auth === 'unknown' ? (
                        <div className="flex flex-col gap-3" role="status">
                            <span className="sr-only">Hazırlanıyor</span>
                            <div className="skeleton h-5 w-40 rounded-chip" aria-hidden="true" />
                            <div className="skeleton h-24 w-full rounded-thumb" aria-hidden="true" />
                        </div>
                    ) : auth === 'out' ? (
                        <div className="flex flex-col items-start gap-3">
                            <p className="text-sm leading-6 text-ink-2">Değerlendirme yazmak için hesabına giriş yapman gerekiyor.</p>
                            <div className="flex flex-wrap gap-2">
                                <Link href={loginHref} prefetch={false} className={buttonClasses({ variant: 'brand', size: '44' })}>
                                    Giriş yap
                                </Link>
                                <Button type="button" variant="plain" size="44" onClick={() => setOpen(false)}>
                                    Vazgeç
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                            <fieldset aria-describedby={error && rating < 1 ? ratingErrorId : undefined}>
                                <legend className="mb-1.5 text-sm font-semibold text-ink">Puanın</legend>
                                <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <label key={n} className="relative cursor-pointer" onMouseEnter={() => setHover(n)}>
                                            <input
                                                ref={n === 1 ? firstFieldRef : undefined}
                                                type="radio"
                                                name="rating"
                                                value={n}
                                                checked={rating === n}
                                                onChange={() => { setRating(n); setError('') }}
                                                className="peer sr-only"
                                            />
                                            <span className="sr-only">{n} yıldız, {RATING_LABELS[n]}</span>
                                            <svg
                                                viewBox="0 0 20 20"
                                                aria-hidden="true"
                                                className={cn(
                                                    'h-11 w-11 p-1.5 transition-colors duration-150 peer-focus-visible:rounded-thumb peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600',
                                                    n <= shown ? 'text-ink' : 'text-line-strong',
                                                )}
                                                fill="currentColor"
                                            >
                                                <path d={STAR_PATH} />
                                            </svg>
                                        </label>
                                    ))}
                                    <span className="ml-2 text-sm text-muted" aria-hidden="true">{RATING_LABELS[shown]}</span>
                                </div>
                            </fieldset>

                            <div>
                                <label htmlFor={`${formId}-comment`} className="mb-1.5 block text-sm font-semibold text-ink">
                                    Yorumun <span className="font-normal text-muted">(isteğe bağlı)</span>
                                </label>
                                <textarea
                                    id={`${formId}-comment`}
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                    maxLength={1000}
                                    rows={4}
                                    placeholder="Ürünü nasıl buldun? Kalitesi, kargosu, kullanımı…"
                                    className="block w-full resize-y rounded-thumb border border-line-strong bg-white px-3 py-2.5 text-[15px] leading-6 text-ink placeholder:text-subtle focus:border-brand-600 focus:outline-none"
                                />
                            </div>

                            <p id={ratingErrorId} role="alert" className={cn('text-sm font-semibold text-danger', !error && 'sr-only')}>
                                {error}
                            </p>

                            <div className="flex flex-wrap gap-2">
                                <Button type="submit" variant="brand" size="44" isLoading={sending}>
                                    Gönder
                                </Button>
                                <Button type="button" variant="plain" size="44" onClick={() => { setOpen(false); setError('') }}>
                                    Vazgeç
                                </Button>
                            </div>
                        </form>
                    )}
                </div>
            )}
        </div>
    )
}

export default ReviewForm
