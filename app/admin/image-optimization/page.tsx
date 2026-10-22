'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Loader2, RefreshCw, Zap } from 'lucide-react'
import { MissingVariantsPanel } from '@/components/admin/MissingVariantsPanel'

/**
 * Admin › Görsel Optimizasyonu: the real state of the small WebP copies (v/<w>/<key>.webp) of every image the
 * storefront shows, from GET /api/admin/optimize-images/ (one R2 listing). The copies are made automatically
 * (on upload and by the daily cron); MissingVariantsPanel below can still make missing ones in the browser.
 */

interface Coverage {
    images: number
    ready: number
    partial: number
    missing: number
    unsupported: number
    noOriginal: number
    originalBytes: number
    cardBytes: number
    cardOriginalBytes: number
    automatic: boolean
}

function formatBytes(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} MB`
    return `${Math.round(bytes / 1024).toLocaleString('tr-TR')} KB`
}

export default function ImageOptimizationPage() {
    const [coverage, setCoverage] = useState<Coverage | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/optimize-images/', { cache: 'no-store' })
            const data = await res.json().catch(() => null)
            if (!res.ok || !data || typeof data.images !== 'number') throw new Error(data?.error || `HTTP ${res.status}`)
            setCoverage(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Görsel durumu okunamadı.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    const c = coverage
    const incomplete = c ? c.partial + c.missing : 0
    const readyPct = c && c.images > 0 ? Math.round((c.ready / c.images) * 100) : 0
    const lighterPct = c && c.cardOriginalBytes > 0 ? Math.round((1 - c.cardBytes / c.cardOriginalBytes) * 100) : 0

    return (
        <div>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Görsel Optimizasyonu</h1>
                <Button variant="outline" onClick={load} disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    Yenile
                </Button>
            </div>

            {error && (
                <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <span>Görsel durumu okunamadı: {error}</span>
                </div>
            )}

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Sitede gösterilen görsel</p>
                    <p className="text-3xl font-bold text-slate-900">{c ? c.images : '–'}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Küçük kopyaları hazır</p>
                    <p className="text-3xl font-bold text-green-600">{c ? c.ready : '–'}</p>
                    {c && c.images > 0 && <p className="text-xs text-slate-500 mt-1">%{readyPct}</p>}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Eksik</p>
                    <p className={`text-3xl font-bold ${incomplete > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{c ? incomplete : '–'}</p>
                    {c && c.partial > 0 && <p className="text-xs text-slate-500 mt-1">{c.partial} tanesinin bazı boyutları var</p>}
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Ürün kartında yüklenen</p>
                    <p className="text-3xl font-bold text-blue-600">{c && c.cardOriginalBytes > 0 ? `%${lighterPct} daha hafif` : '–'}</p>
                    {c && c.cardOriginalBytes > 0 && (
                        <p className="text-xs text-slate-500 mt-1">
                            Orijinaller {formatBytes(c.cardOriginalBytes)}, kartlardaki kopyalar {formatBytes(c.cardBytes)}
                        </p>
                    )}
                </div>
            </div>

            {c && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 max-w-3xl space-y-3 text-sm text-slate-700">
                    <div className="flex items-start gap-3">
                        {c.automatic
                            ? <Zap className="w-5 h-5 shrink-0 text-green-600" />
                            : <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />}
                        <p>
                            {c.automatic
                                ? 'Otomatik: yeni yüklenen ya da değiştirilen görsellerin küçük kopyaları (200, 400, 800 ve 1200 px WebP) yükleme anında hazırlanır; kaçan olursa her sabah 10:00\'da tamamlanır. Bir şey yapmanıza gerek yok.'
                                : 'Sunucuda otomatik kopya oluşturma şu an kullanılamıyor. Yeni görsellerin kopyalarını yüklerken tarayıcınız hazırlar; eksik kalanları aşağıdaki panelden oluşturabilirsiniz.'}
                        </p>
                    </div>
                    {incomplete === 0 && c.images > 0 && (
                        <div className="flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 shrink-0 text-green-600" />
                            <p>Sitede gösterilen bütün görsellerin küçük kopyaları hazır.</p>
                        </div>
                    )}
                    {c.noOriginal > 0 && (
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600" />
                            <p>{c.noOriginal} görselin orijinali depoda bulunamadı (bozuk görsel bağlantısı). İlgili ürünün görselini yeniden yükleyin.</p>
                        </div>
                    )}
                    {c.unsupported > 0 && (
                        <p className="text-slate-500">{c.unsupported} görsel (SVG ya da GIF) küçültülmeden, olduğu gibi gösteriliyor.</p>
                    )}
                    <p className="text-slate-500">Tüm orijinallerin toplam boyutu: {formatBytes(c.originalBytes)}. Orijinaller silinmez; kopyalar onların yanında durur.</p>
                </div>
            )}

            <MissingVariantsPanel />
        </div>
    )
}
