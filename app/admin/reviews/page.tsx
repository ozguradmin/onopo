'use client'

import * as React from 'react'
import { Star, Trash2, Edit, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
                                        <p className="font-medium text-slate-900">{review.user_name || 'Anonim'}</p>
                                        <p className="text-xs text-slate-500">{review.user_email}</p>
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
