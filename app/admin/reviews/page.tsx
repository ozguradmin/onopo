'use client'

import * as React from 'react'
import { Star, Trash2, Edit, Save, X, Mail, BadgeCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Admin › Yorumlar: every review (account reviews and reviews written through an order's review link) with
// edit/delete, and the switch + last 30 days of the review-request e-mails (/api/admin/review-requests).

interface RequestStats {
    ready: boolean
    enabled: boolean
    days: number
    sent: number
    failed: number
    reviews: number
}

function ReviewRequestsBox() {
    const [stats, setStats] = React.useState<RequestStats | null>(null)
    const [saving, setSaving] = React.useState(false)
    const [error, setError] = React.useState('')

    React.useEffect(() => {
        fetch('/api/admin/review-requests/', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(data => { if (data && typeof data.enabled === 'boolean') setStats(data) })
            .catch(() => setError('E-posta bilgileri okunamadı.'))
    }, [])

    const toggle = async () => {
        if (!stats || saving) return
        setSaving(true)
        setError('')
        try {
            const res = await fetch('/api/admin/review-requests/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: !stats.enabled }),
            })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data || typeof data.enabled !== 'boolean') throw new Error('save')
            setStats(data)
        } catch {
            setError('Ayar kaydedilemedi.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                        <Mail className="w-4 h-4" />
                    </span>
                    <div>
                        <h2 className="font-semibold text-slate-900">Değerlendirme e-postaları</h2>
                        <p className="mt-0.5 max-w-xl text-sm text-slate-500">
                            Teslim edilen siparişlere (Tamamlandı, ya da 7 günden uzun süredir Kargoya Verildi; sipariş 5–45 gün önce)
                            her gün en fazla 20 e-posta gider. Her sipariş tek bir kez sorulur; misafir müşteriler de bağlantıyla
                            &quot;Doğrulanmış alıcı&quot; olarak değerlendirme yazabilir.
                        </p>
                    </div>
                </div>
                {stats && (
                    <label className="relative inline-flex cursor-pointer items-center gap-3">
                        <span className="text-sm font-medium text-slate-700">{stats.enabled ? 'Açık' : 'Kapalı'}</span>
                        <input type="checkbox" className="peer sr-only" checked={stats.enabled} onChange={toggle} disabled={saving} />
                        <span className="h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:right-[22px] after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-emerald-500 peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400" />
                    </label>
                )}
            </div>
            {stats && !stats.ready && (
                <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    Veritabanı güncellemesi (migrations/2026-10-22-guest-reviews.sql) henüz çalıştırılmadı; e-postalar gönderilmiyor.
                </p>
            )}
            {stats && stats.ready && (
                <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Gönderilen</dt>
                        <dd className="text-xl font-bold text-slate-900 tabular-nums">{stats.sent}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Gönderilemeyen</dt>
                        <dd className={`text-xl font-bold tabular-nums ${stats.failed > 0 ? 'text-red-600' : 'text-slate-900'}`}>{stats.failed}</dd>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs text-slate-500">Gelen değerlendirme</dt>
                        <dd className="text-xl font-bold text-emerald-700 tabular-nums">{stats.reviews}</dd>
                    </div>
                    <p className="col-span-3 text-xs text-slate-400">Son {stats.days} gün</p>
                </dl>
            )}
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
    )
}

export default function AdminReviewsPage() {
    const [reviews, setReviews] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [editingId, setEditingId] = React.useState<number | null>(null)
    const [editForm, setEditForm] = React.useState({ rating: 5, comment: '' })

    React.useEffect(() => {
        fetchReviews()
    }, [])

    const fetchReviews = async () => {
        try {
            const res = await fetch('/api/admin/reviews')
            const data = await res.json()
            if (Array.isArray(data)) setReviews(data)
        } catch (e) {
            console.error('Failed to fetch reviews:', e)
        } finally {
            setLoading(false)
        }
    }

    const handleEdit = (review: any) => {
        setEditingId(review.id)
        setEditForm({ rating: review.rating, comment: review.comment || '' })
    }

    const handleSave = async (id: number) => {
        try {
            await fetch(`/api/admin/reviews/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            })
            setEditingId(null)
            fetchReviews()
        } catch (e) {
            console.error('Failed to update review:', e)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Bu yorumu silmek istediğinizden emin misiniz?')) return
        try {
            await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' })
            fetchReviews()
        } catch (e) {
            console.error('Failed to delete review:', e)
        }
    }

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Yorumlar</h1>
                <span className="text-sm text-slate-500">{reviews.length} yorum</span>
            </div>

            <ReviewRequestsBox />

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ürün</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kullanıcı</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Puan</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Yorum</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Tarih</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {reviews.map((review) => (
                            <tr key={review.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3">
                                    <span className="font-medium text-slate-900">{review.product_name || 'Bilinmeyen'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div>
                                        <p className="font-medium text-slate-900">{review.user_name || review.reviewer_name || 'Anonim'}</p>
                                        {review.user_email && <p className="text-xs text-slate-500">{review.user_email}</p>}
                                        {Number(review.verified) === 1 && (
                                            <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                                                <BadgeCheck className="w-3.5 h-3.5" />
                                                Doğrulanmış alıcı{review.order_id ? ` · Sipariş #${review.order_id}` : ''}
                                            </p>
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    {editingId === review.id ? (
                                        <select
                                            value={editForm.rating}
                                            onChange={(e) => setEditForm({ ...editForm, rating: parseInt(e.target.value) })}
                                            className="border rounded px-2 py-1"
                                        >
                                            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                                        </select>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            {Array.from({ length: 5 }).map((_, i) => (
                                                <Star
                                                    key={i}
                                                    className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 max-w-xs">
                                    {editingId === review.id ? (
                                        <textarea
                                            value={editForm.comment}
                                            onChange={(e) => setEditForm({ ...editForm, comment: e.target.value })}
                                            className="w-full border rounded px-2 py-1 text-sm"
                                            rows={2}
                                        />
                                    ) : (
                                        <p className="text-sm text-slate-600 truncate">{review.comment || '-'}</p>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-500">
                                    {new Date(review.created_at).toLocaleDateString('tr-TR')}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {editingId === review.id ? (
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleSave(review.id)}>
                                                <Save className="w-4 h-4 text-green-600" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}>
                                                <X className="w-4 h-4 text-slate-400" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-end gap-2">
                                            <Button size="icon" variant="ghost" onClick={() => handleEdit(review)}>
                                                <Edit className="w-4 h-4 text-slate-500" />
                                            </Button>
                                            <Button size="icon" variant="ghost" onClick={() => handleDelete(review.id)}>
                                                <Trash2 className="w-4 h-4 text-red-500" />
                                            </Button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {reviews.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                    Henüz yorum yok
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
