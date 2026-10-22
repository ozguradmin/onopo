'use client'

/**
 * Admin › Sistem kayıtları: what the automatic jobs could not do (lib/system-log.ts).
 *
 * The assistant's product facts, image variants and the daily cron run by themselves; their failures land
 * here instead of in the Worker logs. Newest first, filters for source and level, how many times and when
 * last. "Çözüldü" hides an entry until the same problem happens again. The sidebar shows the number of
 * open errors.
 *
 * Data: GET/POST /api/admin/system-logs/.
 */
import * as React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface LogItem {
    id: number
    created_at: string
    source: string
    level: 'error' | 'warn' | 'info'
    message: string
    detail: string | null
    ref: string | null
    count: number
    last_at: string
    resolved_at: string | null
}

type Counts = { error: number; warn: number; info: number }

const SOURCES: { value: string; label: string }[] = [
    { value: '', label: 'Tümü' },
    { value: 'facts', label: 'Asistan ürün bilgileri' },
    { value: 'images', label: 'Görseller' },
    { value: 'cron', label: 'Günlük otomatik işler' },
    { value: 'assistant', label: 'AI Asistan' },
    { value: 'reviews', label: 'Değerlendirme e-postaları' },
    { value: 'redirects', label: 'Yönlendirmeler' },
    { value: 'other', label: 'Diğer' },
]
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.filter(s => s.value).map(s => [s.value, s.label]))

const LEVELS: { value: string; label: string }[] = [
    { value: '', label: 'Hepsi' },
    { value: 'error', label: 'Hata' },
    { value: 'warn', label: 'Uyarı' },
    { value: 'info', label: 'Bilgi' },
]

const LEVEL_STYLE: Record<LogItem['level'], { label: string; className: string; Icon: typeof AlertCircle }> = {
    error: { label: 'Hata', className: 'bg-red-50 text-red-700 border-red-200', Icon: AlertCircle },
    warn: { label: 'Uyarı', className: 'bg-amber-50 text-amber-800 border-amber-200', Icon: AlertTriangle },
    info: { label: 'Bilgi', className: 'bg-slate-50 text-slate-600 border-slate-200', Icon: Info },
}

/** Turkey time, e.g. "22 Eki 10:04". */
function formatTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
}

export default function SystemLogsPage() {
    const [items, setItems] = React.useState<LogItem[] | null>(null)
    const [counts, setCounts] = React.useState<Counts>({ error: 0, warn: 0, info: 0 })
    const [source, setSource] = React.useState('')
    const [level, setLevel] = React.useState('')
    const [showResolved, setShowResolved] = React.useState(false)
    const [loading, setLoading] = React.useState(false)
    const [error, setError] = React.useState('')
    const [busyId, setBusyId] = React.useState<number | null>(null)

    const load = React.useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const q = new URLSearchParams()
            if (source) q.set('source', source)
            if (level) q.set('level', level)
            if (showResolved) q.set('resolved', '1')
            const res = await fetch(`/api/admin/system-logs/?${q}`, { cache: 'no-store' })
            const d = await res.json().catch(() => null)
            if (!res.ok || !d || !Array.isArray(d.items)) throw new Error()
            setItems(d.items)
            if (d.unresolved) setCounts(d.unresolved)
        } catch {
            setError('Kayıtlar yüklenemedi, lütfen tekrar dene.')
        } finally {
            setLoading(false)
        }
    }, [source, level, showResolved])

    React.useEffect(() => { void load() }, [load])

    const resolve = async (body: { id: number } | { all: true; source?: string }) => {
        setBusyId('id' in body ? body.id : -1)
        try {
            const res = await fetch('/api/admin/system-logs/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            const d = await res.json().catch(() => null)
            if (!res.ok) throw new Error()
            if (d?.unresolved) setCounts(d.unresolved)
            // Tell the sidebar badge
            window.dispatchEvent(new Event('onopo:system-logs-changed'))
            await load()
        } catch {
            setError('İşaretlenemedi, lütfen tekrar dene.')
        } finally {
            setBusyId(null)
        }
    }

    const open = (items ?? []).filter(i => !i.resolved_at)

    return (
        <div className="max-w-5xl space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Sistem kayıtları</h1>
                    <p className="mt-1 max-w-2xl text-sm text-slate-600">
                        Asistanın ürün bilgileri, görsellerin küçültülmüş kopyaları ve her sabahki otomatik işler kendiliğinden çalışır.
                        Bir şey yapılamazsa burada görünür. Sorunu giderdiysen ya da önemli değilse &ldquo;Çözüldü&rdquo; de; aynı sorun
                        tekrar olursa kayıt geri gelir.
                    </p>
                </div>
                <Button type="button" variant="outline" onClick={() => void load()} disabled={loading} className="gap-2">
                    <RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} /> Yenile
                </Button>
            </div>

            <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 font-medium text-red-700">{counts.error} açık hata</span>
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 font-medium text-amber-800">{counts.warn} uyarı</span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600">{counts.info} bilgi</span>
            </div>

            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Konu</span>
                    <select value={source} onChange={e => setSource(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3">
                        {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                </label>
                <label className="text-sm">
                    <span className="mb-1 block font-medium text-slate-700">Önem</span>
                    <select value={level} onChange={e => setLevel(e.target.value)} className="h-10 rounded-lg border border-slate-300 bg-white px-3">
                        {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                </label>
                <label className="flex h-10 items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)} className="h-4 w-4" />
                    Çözülenleri de göster
                </label>
                {open.length > 1 && (
                    <Button type="button" variant="ghost" className="ml-auto" disabled={busyId !== null} onClick={() => void resolve(source ? { all: true, source } : { all: true })}>
                        Listedekilerin hepsi çözüldü
                    </Button>
                )}
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}

            {items && items.length === 0 && !error && (
                <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
                    <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <p className="text-sm font-medium">Açık kayıt yok; otomatik işler sorunsuz çalışıyor.</p>
                </div>
            )}

            {items && items.length > 0 && (
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {items.map(item => {
                        const style = LEVEL_STYLE[item.level] ?? LEVEL_STYLE.info
                        return (
                            <li key={item.id} className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start${item.resolved_at ? ' opacity-60' : ''}`}>
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-xs">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${style.className}`}>
                                            <style.Icon className="h-3.5 w-3.5" aria-hidden="true" /> {style.label}
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{SOURCE_LABEL[item.source] ?? item.source}</span>
                                        {item.ref && <span className="break-all font-mono text-slate-500">{item.ref}</span>}
                                    </div>
                                    <p className="break-words font-medium text-slate-900">{item.message}</p>
                                    {item.detail && <p className="break-words text-sm text-slate-600">{item.detail}</p>}
                                    <p className="text-xs text-slate-500">
                                        Son: {formatTime(item.last_at)}
                                        {item.count > 1 && <> · {item.count} kez (ilk: {formatTime(item.created_at)})</>}
                                        {item.resolved_at && <> · Çözüldü: {formatTime(item.resolved_at)}</>}
                                    </p>
                                </div>
                                {!item.resolved_at && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 gap-1.5 self-start"
                                        disabled={busyId !== null}
                                        onClick={() => void resolve({ id: item.id })}
                                    >
                                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Çözüldü
                                    </Button>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}

            {!items && !error && <p className="text-sm text-slate-500">Yükleniyor...</p>}
        </div>
    )
}
