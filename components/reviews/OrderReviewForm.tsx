'use client'

/**
 * The form of /degerlendir/ (review link from the review-request e-mail): one card per product of the order with
 * 1–5 stars and an optional comment. Only rated products are sent, all in one
 *   POST /api/reviews/order/ { token, reviews: [{ productId, rating, comment }] }
 * Products this order already reviewed are shown as done. No account, no reload: after a successful post the
 * sent products switch to "Değerlendirildi".
 */
import * as React from 'react'
import Link from 'next/link'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FallbackImage } from '@/components/ui/FallbackImage'

export interface OrderReviewItem {
    productId: number
    name: string
    /** Product page, only while the product is active. */
    href: string | null
    image: string | null
    imageFallback: string | null
    reviewed: boolean
}

const RATING_LABELS = ['', 'Çok kötü', 'Kötü', 'İdare eder', 'İyi', 'Çok iyi']
const STAR_PATH = 'M10 1.6l2.47 5.2 5.69.67-4.2 3.9 1.11 5.62L10 14.2l-5.07 2.79 1.11-5.62-4.2-3.9 5.69-.67L10 1.6z'
const COMMENT_MAX = 1000

type Draft = { rating: number; comment: string }

function StarPicker({ name, value, onChange, labelledBy }: { name: string; value: number; onChange: (n: number) => void; labelledBy: string }) {
    const [hover, setHover] = React.useState(0)
    const shown = hover || value
    return (
        <div role="radiogroup" aria-labelledby={labelledBy} className="flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map(n => (
                <label key={n} className="relative cursor-pointer" onMouseEnter={() => setHover(n)}>
                    <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
                    <span className="sr-only">{n} yıldız, {RATING_LABELS[n]}</span>
                    <svg
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                        fill="currentColor"
                        className={cn(
                            'h-11 w-11 p-1.5 transition-colors duration-150 peer-focus-visible:rounded-thumb peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand-600',
                            n <= shown ? 'text-warning' : 'text-line-strong',
                        )}
                    >
                        <path d={STAR_PATH} />
                    </svg>
                </label>
            ))}
            <span className="ml-1.5 min-w-[5.5rem] text-sm text-muted" aria-hidden="true">{RATING_LABELS[shown]}</span>
        </div>
    )
}

export function OrderReviewForm({ token, items }: { token: string; items: OrderReviewItem[] }) {
    const [drafts, setDrafts] = React.useState<Record<number, Draft>>({})
    const [done, setDone] = React.useState<Set<number>>(() => new Set(items.filter(i => i.reviewed).map(i => i.productId)))
    const [sending, setSending] = React.useState(false)
    const [error, setError] = React.useState('')
    const [thanks, setThanks] = React.useState(false)
    const baseId = React.useId()

    const open = items.filter(i => !done.has(i.productId))
    const rated = open.filter(i => (drafts[i.productId]?.rating ?? 0) > 0)

    const update = (productId: number, patch: Partial<Draft>) => {
        setDrafts(prev => ({ ...prev, [productId]: { ...(prev[productId] ?? { rating: 0, comment: '' }), ...patch } }))
        setError('')
    }

    const submit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (sending) return
        if (!rated.length) {
            setError('En az bir ürüne yıldız ver.')
            return
        }
        setSending(true)
        setError('')
        try {
            const res = await fetch('/api/reviews/order/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    reviews: rated.map(i => ({ productId: i.productId, rating: drafts[i.productId].rating, comment: drafts[i.productId].comment.trim() })),
                }),
            })
            const data = (await res.json().catch(() => ({}))) as { error?: string; created?: number[]; duplicates?: number[] }
            const finished = [...(data.created ?? []), ...(data.duplicates ?? [])]
            if (finished.length) setDone(prev => new Set([...prev, ...finished]))
            if (!res.ok) {
                setError(res.status === 409 ? 'Bu ürünleri zaten değerlendirmişsin. Teşekkürler!' : data.error || 'Değerlendirme gönderilemedi, lütfen tekrar dene.')
                return
            }
            setThanks(true)
        } catch {
            setError('Bağlantı hatası. Lütfen tekrar dene.')
        } finally {
            setSending(false)
        }
    }

    return (
        <form onSubmit={submit} noValidate className="mt-6 flex flex-col gap-4">
            {thanks && (
                <p role="status" className="rounded-card bg-success-50 px-4 py-3 text-sm font-semibold text-success">
                    Teşekkürler! Değerlendirmen yayınlandı.
                </p>
            )}

            <ul className="flex flex-col gap-3">
                {items.map(item => {
                    const isDone = done.has(item.productId)
                    const draft = drafts[item.productId] ?? { rating: 0, comment: '' }
                    const titleId = `${baseId}-${item.productId}-title`
                    return (
                        <li key={item.productId} className="rounded-card border border-line p-4">
                            <div className="flex items-center gap-3">
                                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-thumb border border-line bg-white">
                                    {item.image ? (
                                        <FallbackImage src={item.image} fallbackSrc={item.imageFallback} alt={item.name} width={64} height={64} loading="lazy" className="h-full w-full object-contain p-1" />
                                    ) : null}
                                </span>
                                <p id={titleId} className="line-clamp-2 text-[15px] font-semibold leading-5 text-ink">
                                    {item.href ? (
                                        <Link href={item.href} prefetch={false} className="hover:underline hover:underline-offset-4">
                                            {item.name}
                                        </Link>
                                    ) : (
                                        item.name
                                    )}
                                </p>
                            </div>

                            {isDone ? (
                                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-success">
                                    <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                                    Değerlendirildi
                                </p>
                            ) : (
                                <div className="mt-3 flex flex-col gap-3">
                                    <StarPicker name={`rating-${item.productId}`} value={draft.rating} onChange={n => update(item.productId, { rating: n })} labelledBy={titleId} />
                                    {draft.rating > 0 && (
                                        <div>
                                            <label htmlFor={`${baseId}-${item.productId}-comment`} className="mb-1.5 block text-sm font-semibold text-ink">
                                                Yorumun <span className="font-normal text-muted">(isteğe bağlı)</span>
                                            </label>
                                            <textarea
                                                id={`${baseId}-${item.productId}-comment`}
                                                value={draft.comment}
                                                onChange={e => update(item.productId, { comment: e.target.value })}
                                                maxLength={COMMENT_MAX}
                                                rows={3}
                                                placeholder="Ürünü nasıl buldun? Kalitesi, kargosu, kullanımı…"
                                                className="block w-full resize-y rounded-thumb border border-line-strong bg-white px-3 py-2.5 text-[15px] leading-6 text-ink placeholder:text-subtle focus:border-brand-600 focus:outline-none"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    )
                })}
            </ul>

            <p role="alert" className={cn('text-sm font-semibold text-danger', !error && 'sr-only')}>
                {error}
            </p>

            {open.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" variant="brand" size="48" isLoading={sending} className="w-full sm:w-auto">
                        {rated.length > 1 ? `${rated.length} değerlendirmeyi gönder` : 'Değerlendirmeyi gönder'}
                    </Button>
                    <p className="text-xs leading-5 text-muted">Yalnızca yıldız verdiğin ürünler gönderilir.</p>
                </div>
            )}
        </form>
    )
}

export default OrderReviewForm
