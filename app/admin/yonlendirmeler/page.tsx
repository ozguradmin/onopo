'use client'

/**
 * Admin › Yönlendirmeler: old addresses (the previous shop's links still in Google, renamed products) and where
 * they go.
 *
 * The site already redirects most old addresses by itself (worker.ts + lib/redirects.ts: old URL patterns and a
 * careful name match). What it could not place is listed here:
 * - "Bulunamayan sayfalar": 404s of visitors and Googlebot, most visited first, with the matcher's suggestion
 *   ("Önerilene yönlendir"), a hand-picked address ("Başka adrese yönlendir…") or "Yok say".
 * - "Yönlendirmeler": the hand-made redirects (add, edit, delete, how often each was used).
 * - "Search Console listesini yükle": a pasted list or Search Console's CSV export, checked address by address;
 *   the admin ticks the rows to keep and saves them in one go.
 *
 * Data: /api/admin/redirects/ (GET/POST/PUT/DELETE), /api/admin/redirects/not-found/ (GET/POST),
 * /api/admin/redirects/resolve/ (POST). The server checks every address again (validateRedirect).
 */
import * as React from 'react'
import { ArrowRight, Check, ExternalLink, EyeOff, FileUp, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'

// ---- API types ------------------------------------------------------------------------------------------

interface Suggestion { target: string; label: string; score: number; kind: 'auto' | 'suggested' }
interface NotFoundRow {
    path: string
    hits: number
    googlebotHits: number
    firstSeen: string
    lastSeen: string
    referrerHost: string | null
    suggestions: Suggestion[]
}
interface NotFoundResponse { rows: NotFoundRow[]; openCount: number; ignoredCount: number }
interface RedirectRow { from: string; to: string; note: string | null; hits: number; lastHitAt: string | null; createdAt: string; live: boolean }
type UrlStatus = 'invalid' | 'protected' | 'live' | 'has-redirect' | 'auto' | 'suggested' | 'none'
interface UrlReport { input: string; path: string | null; status: UrlStatus; current?: string; suggestions: Suggestion[] }
interface ResolveResponse { rows: UrlReport[]; total: number; truncated: boolean; foreign: number }

const API = '/api/admin/redirects/'

// ---- helpers --------------------------------------------------------------------------------------------

/** Parses ISO strings and SQLite's 'YYYY-MM-DD HH:MM:SS' (UTC) alike. */
function parseTime(s: string | null | undefined): Date | null {
    if (!s) return null
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}Z` : s
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
}

function formatTime(s: string | null | undefined): string {
    const d = parseTime(s)
    if (!d) return '—'
    return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** A stored target as a link the admin can open (paths are stored decoded). */
function hrefOf(target: string): string {
    return target.startsWith('https://') ? target : encodeURI(target)
}

async function send(url: string, method: string, body?: unknown): Promise<any> {
    const res = await fetch(url, {
        method,
        cache: 'no-store',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || 'İşlem yapılamadı. Tekrar deneyin.')
    return data
}

function TargetLink({ target, label }: { target: string; label?: string }) {
    return (
        <a href={hrefOf(target)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-700 hover:underline break-all">
            {label && label !== target ? <span>{label}</span> : <span className="font-mono text-xs">{target}</span>}
            <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
    )
}

const inputClass = 'w-full p-2 border border-slate-200 rounded-lg text-sm'
const primaryBtn = 'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50'
const secondaryBtn = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50'

/** "Başka adrese yönlendir…": one address field with save / cancel. */
function TargetForm({ initial = '', busy, onSave, onCancel }: { initial?: string; busy: boolean; onSave: (to: string) => void; onCancel: () => void }) {
    const [to, setTo] = React.useState(initial)
    return (
        <form onSubmit={e => { e.preventDefault(); if (to.trim()) onSave(to.trim()) }} className="mt-3 flex flex-wrap gap-2">
            <input
                autoFocus
                value={to}
                onChange={e => setTo(e.target.value)}
                placeholder="Yeni adres: /urun-adi/ ya da sayfanın linki"
                className={`${inputClass} flex-1 min-w-[220px]`}
            />
            <button type="submit" disabled={busy || !to.trim()} className={primaryBtn}><Check className="w-4 h-4" /> Kaydet</button>
            <button type="button" onClick={onCancel} className={secondaryBtn}>Vazgeç</button>
        </form>
    )
}

// ---- Tab: Bulunamayan sayfalar ---------------------------------------------------------------------------

function NotFoundTab() {
    const [view, setView] = React.useState<'open' | 'ignored'>('open')
    const [data, setData] = React.useState<NotFoundResponse | null>(null)
    const [state, setState] = React.useState<'loading' | 'ok' | 'error'>('loading')
    const [reload, setReload] = React.useState(0)
    const [editing, setEditing] = React.useState<string | null>(null)
    const [busy, setBusy] = React.useState<string | null>(null)
    const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

    React.useEffect(() => {
        let alive = true
        setState('loading')
        fetch(`${API}not-found/?view=${view}`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d: NotFoundResponse) => {
                if (!alive) return
                setData({ rows: Array.isArray(d.rows) ? d.rows : [], openCount: Number(d.openCount) || 0, ignoredCount: Number(d.ignoredCount) || 0 })
                setState('ok')
            })
            .catch(() => alive && setState('error'))
        return () => { alive = false }
    }, [view, reload])

    const done = (text: string) => {
        setMessage({ kind: 'ok', text })
        setEditing(null)
        setReload(n => n + 1)
    }

    const redirect = async (from: string, to: string) => {
        setBusy(from)
        setMessage(null)
        try {
            await send(API, 'POST', { from, to })
            done('Yönlendirme kaydedildi. Bu adres artık yeni sayfaya gidiyor.')
        } catch (e) {
            setMessage({ kind: 'error', text: (e as Error).message })
        } finally {
            setBusy(null)
        }
    }

    const mark = async (path: string, action: 'ignore' | 'restore') => {
        setBusy(path)
        setMessage(null)
        try {
            await send(`${API}not-found/`, 'POST', { action, paths: [path] })
            done(action === 'ignore' ? 'Adres yok sayıldı.' : 'Adres listeye geri alındı.')
        } catch (e) {
            setMessage({ kind: 'error', text: (e as Error).message })
        } finally {
            setBusy(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
                <button type="button" onClick={() => setView('open')} className={`rounded-full px-3 py-1 font-medium ${view === 'open' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    Bekleyenler{data ? ` (${data.openCount})` : ''}
                </button>
                <button type="button" onClick={() => setView('ignored')} className={`rounded-full px-3 py-1 font-medium ${view === 'ignored' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                    Yok sayılanlar{data ? ` (${data.ignoredCount})` : ''}
                </button>
                {state === 'loading' && <span className="text-slate-500">Yükleniyor...</span>}
            </div>

            {message && (
                <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
            )}
            {state === 'error' && <p className="text-sm text-red-600">Liste yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>}
            {state === 'ok' && data && data.rows.length === 0 && (
                <p className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">
                    {view === 'open'
                        ? 'Şu an bekleyen bulunamayan sayfa yok. Ziyaretçiler ya da Google açılmayan bir adrese geldiğinde burada görünür.'
                        : 'Yok sayılan adres yok.'}
                </p>
            )}

            {data && data.rows.length > 0 && (
                <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {data.rows.map(r => {
                        const best = r.suggestions[0]
                        const isBusy = busy === r.path
                        return (
                            <li key={r.path} className="p-4">
                                <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
                                    <span className="font-mono text-sm text-slate-900 break-all flex-1 min-w-[200px]">{r.path}</span>
                                    <span className="flex flex-wrap items-center gap-1.5 text-xs">
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">{r.hits} kez</span>
                                        {r.googlebotHits > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">Google da açmaya çalıştı</span>}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Son: {formatTime(r.lastSeen)} · İlk: {formatTime(r.firstSeen)}
                                    {r.referrerHost ? ` · Geldiği yer: ${r.referrerHost}` : ''}
                                </p>

                                {best?.kind === 'auto' && (
                                    <p className="mt-2 text-sm text-green-700">
                                        Site bu adresi artık kendisi yönlendiriyor: <TargetLink target={best.target} label={best.label} />
                                    </p>
                                )}
                                {best?.kind === 'suggested' && (
                                    <div className="mt-2 text-sm text-slate-700">
                                        <span className="text-slate-500">Önerilen: </span>
                                        <TargetLink target={best.target} label={best.label} />
                                        {r.suggestions.length > 1 && (
                                            <span className="block mt-1 text-xs text-slate-500">
                                                Diğer olasılıklar:{' '}
                                                {r.suggestions.slice(1).map((s, i) => (
                                                    <React.Fragment key={s.target}>
                                                        {i > 0 && ', '}
                                                        <button type="button" disabled={isBusy} onClick={() => redirect(r.path, s.target)} className="text-blue-700 hover:underline">
                                                            {s.label}
                                                        </button>
                                                    </React.Fragment>
                                                ))}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {!best && <p className="mt-2 text-sm text-slate-500">Benzer bir ürün ya da kategori bulunamadı.</p>}

                                <div className="mt-3 flex flex-wrap gap-2">
                                    {best?.kind === 'suggested' && (
                                        <button type="button" disabled={isBusy} onClick={() => redirect(r.path, best.target)} className={primaryBtn}>
                                            <ArrowRight className="w-4 h-4" /> Önerilene yönlendir
                                        </button>
                                    )}
                                    <button type="button" disabled={isBusy} onClick={() => setEditing(editing === r.path ? null : r.path)} className={secondaryBtn}>
                                        <Pencil className="w-4 h-4" /> Başka adrese yönlendir…
                                    </button>
                                    {view === 'open' ? (
                                        <button type="button" disabled={isBusy} onClick={() => mark(r.path, 'ignore')} className={secondaryBtn}>
                                            <EyeOff className="w-4 h-4" /> Yok say
                                        </button>
                                    ) : (
                                        <button type="button" disabled={isBusy} onClick={() => mark(r.path, 'restore')} className={secondaryBtn}>
                                            <RotateCcw className="w-4 h-4" /> Listeye geri al
                                        </button>
                                    )}
                                </div>
                                {editing === r.path && (
                                    <TargetForm busy={isBusy} onSave={to => redirect(r.path, to)} onCancel={() => setEditing(null)} />
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
            {data && data.rows.length >= 200 && <p className="text-xs text-slate-500">En çok açılmaya çalışılan 200 adres gösteriliyor.</p>}
        </div>
    )
}

// ---- Tab: Yönlendirmeler ---------------------------------------------------------------------------------

function RedirectsTab() {
    const [rows, setRows] = React.useState<RedirectRow[] | null>(null)
    const [state, setState] = React.useState<'loading' | 'ok' | 'error'>('loading')
    const [reload, setReload] = React.useState(0)
    const [form, setForm] = React.useState({ from: '', to: '', note: '' })
    const [showAdd, setShowAdd] = React.useState(false)
    const [editing, setEditing] = React.useState<string | null>(null)
    const [editForm, setEditForm] = React.useState({ from: '', to: '', note: '' })
    const [busy, setBusy] = React.useState(false)
    const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

    React.useEffect(() => {
        let alive = true
        setState('loading')
        fetch(API, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(d => {
                if (!alive) return
                setRows(Array.isArray(d.redirects) ? d.redirects : [])
                setState('ok')
            })
            .catch(() => alive && setState('error'))
        return () => { alive = false }
    }, [reload])

    const run = async (fn: () => Promise<void>, ok: string) => {
        setBusy(true)
        setMessage(null)
        try {
            await fn()
            setMessage({ kind: 'ok', text: ok })
            setReload(n => n + 1)
            return true
        } catch (e) {
            setMessage({ kind: 'error', text: (e as Error).message })
            return false
        } finally {
            setBusy(false)
        }
    }

    const add = async (e: React.FormEvent) => {
        e.preventDefault()
        const saved = await run(() => send(API, 'POST', form), 'Yönlendirme eklendi.')
        if (saved) { setForm({ from: '', to: '', note: '' }); setShowAdd(false) }
    }

    const saveEdit = async (originalFrom: string) => {
        const saved = await run(() => send(API, 'PUT', { originalFrom, ...editForm }), 'Yönlendirme güncellendi.')
        if (saved) setEditing(null)
    }

    const remove = async (from: string) => {
        if (!confirm(`${from} adresinin yönlendirmesi silinsin mi? Bu adres yeniden "bulunamadı" sayfasını gösterir (site kendisi bir eşleşme bulamazsa).`)) return
        await run(() => send(`${API}?from=${encodeURIComponent(from)}`, 'DELETE'), 'Yönlendirme silindi.')
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 justify-between">
                <p className="text-sm text-slate-500">{rows ? `${rows.length} yönlendirme` : ' '}{state === 'loading' ? ' · Yükleniyor...' : ''}</p>
                <button type="button" onClick={() => setShowAdd(v => !v)} className={primaryBtn}><Plus className="w-4 h-4" /> Yönlendirme ekle</button>
            </div>

            {showAdd && (
                <form onSubmit={add} className="bg-white rounded-xl border border-slate-200 p-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm">
                        <span className="block text-xs font-medium text-slate-500 mb-1">Eski adres (açılmayan)</span>
                        <input value={form.from} onChange={e => setForm({ ...form, from: e.target.value })} placeholder="/urun/eski-urun-adi/" className={inputClass} required />
                    </label>
                    <label className="text-sm">
                        <span className="block text-xs font-medium text-slate-500 mb-1">Yeni adres (gideceği sayfa)</span>
                        <input value={form.to} onChange={e => setForm({ ...form, to: e.target.value })} placeholder="/yeni-urun-adi/ ya da sayfanın linki" className={inputClass} required />
                    </label>
                    <label className="text-sm md:col-span-2">
                        <span className="block text-xs font-medium text-slate-500 mb-1">Not (isteğe bağlı)</span>
                        <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="ör. eski sitedeki kampanya sayfası" className={inputClass} />
                    </label>
                    <div className="md:col-span-2 flex gap-2">
                        <button type="submit" disabled={busy} className={primaryBtn}><Check className="w-4 h-4" /> Kaydet</button>
                        <button type="button" onClick={() => setShowAdd(false)} className={secondaryBtn}>Vazgeç</button>
                    </div>
                </form>
            )}

            {message && (
                <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
            )}
            {state === 'error' && <p className="text-sm text-red-600">Yönlendirmeler yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>}
            {state === 'ok' && rows && rows.length === 0 && (
                <p className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500">Henüz elle eklenmiş yönlendirme yok.</p>
            )}

            {rows && rows.length > 0 && (
                <ul className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
                    {rows.map(r => (
                        <li key={r.from} className="p-4">
                            {editing === r.from ? (
                                <form onSubmit={e => { e.preventDefault(); saveEdit(r.from) }} className="grid gap-2 md:grid-cols-2">
                                    <input value={editForm.from} onChange={e => setEditForm({ ...editForm, from: e.target.value })} className={inputClass} aria-label="Eski adres" />
                                    <input value={editForm.to} onChange={e => setEditForm({ ...editForm, to: e.target.value })} className={inputClass} aria-label="Yeni adres" />
                                    <input value={editForm.note} onChange={e => setEditForm({ ...editForm, note: e.target.value })} placeholder="Not" className={`${inputClass} md:col-span-2`} aria-label="Not" />
                                    <div className="md:col-span-2 flex gap-2">
                                        <button type="submit" disabled={busy} className={primaryBtn}><Check className="w-4 h-4" /> Kaydet</button>
                                        <button type="button" onClick={() => setEditing(null)} className={secondaryBtn}>Vazgeç</button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                        <span className="font-mono text-slate-900 break-all">{r.from}</span>
                                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                                        <TargetLink target={r.to} />
                                        {!r.live && (
                                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                                Hedef sayfa açılmıyor, yönlendirme çalışmıyor
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">
                                        {r.hits} kez kullanıldı{r.lastHitAt ? ` · Son: ${formatTime(r.lastHitAt)}` : ''} · Eklendi: {formatTime(r.createdAt)}
                                        {r.note ? ` · ${r.note}` : ''}
                                    </p>
                                    <div className="mt-2 flex gap-2">
                                        <button type="button" onClick={() => { setEditing(r.from); setEditForm({ from: r.from, to: r.to, note: r.note ?? '' }) }} className={secondaryBtn}>
                                            <Pencil className="w-4 h-4" /> Düzenle
                                        </button>
                                        <button type="button" disabled={busy} onClick={() => remove(r.from)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                                            <Trash2 className="w-4 h-4" /> Sil
                                        </button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

// ---- Tab: Search Console listesini yükle ----------------------------------------------------------------

const STATUS_TEXT: Record<UrlStatus, { label: string; className: string }> = {
    suggested: { label: 'Öneri var', className: 'bg-amber-50 text-amber-700' },
    none: { label: 'Öneri yok', className: 'bg-slate-100 text-slate-600' },
    auto: { label: 'Site kendisi yönlendiriyor', className: 'bg-green-50 text-green-700' },
    'has-redirect': { label: 'Zaten yönlendirilmiş', className: 'bg-green-50 text-green-700' },
    live: { label: 'Sayfa açılıyor', className: 'bg-green-50 text-green-700' },
    protected: { label: 'Yönlendirilmez', className: 'bg-slate-100 text-slate-600' },
    invalid: { label: 'Bu sitenin adresi değil', className: 'bg-slate-100 text-slate-600' },
}
const STATUS_ORDER: UrlStatus[] = ['suggested', 'none', 'auto', 'has-redirect', 'live', 'protected', 'invalid']

interface Choice { selected: boolean; to: string }

function ImportTab() {
    const [text, setText] = React.useState('')
    const [fileName, setFileName] = React.useState('')
    const [result, setResult] = React.useState<ResolveResponse | null>(null)
    const [choices, setChoices] = React.useState<Record<string, Choice>>({})
    const [busy, setBusy] = React.useState(false)
    const [message, setMessage] = React.useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
    const [errors, setErrors] = React.useState<Array<{ from: string; error: string }>>([])

    const readFile = (file: File | undefined) => {
        if (!file) return
        if (file.size > 2_000_000) { setMessage({ kind: 'error', text: 'Dosya çok büyük (en fazla 2 MB).' }); return }
        const reader = new FileReader()
        reader.onload = () => { setText(String(reader.result ?? '')); setFileName(file.name); setMessage(null) }
        reader.onerror = () => setMessage({ kind: 'error', text: 'Dosya okunamadı.' })
        reader.readAsText(file)
    }

    const check = async () => {
        setBusy(true)
        setMessage(null)
        setErrors([])
        try {
            const d: ResolveResponse = await send(`${API}resolve/`, 'POST', { text })
            const rows = [...d.rows].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
            setResult({ ...d, rows })
            const next: Record<string, Choice> = {}
            for (const r of rows) {
                if (!r.path) continue
                // Suggestions start ticked (the admin looks them over and unticks wrong ones); the rest start empty
                next[r.path] = { selected: r.status === 'suggested', to: r.status === 'suggested' ? r.suggestions[0].target : '' }
            }
            setChoices(next)
        } catch (e) {
            setMessage({ kind: 'error', text: (e as Error).message })
        } finally {
            setBusy(false)
        }
    }

    const setChoice = (path: string, patch: Partial<Choice>) => setChoices(c => ({ ...c, [path]: { ...c[path], ...patch } }))
    const actionable = (r: UrlReport) => !!r.path && (r.status === 'suggested' || r.status === 'none' || r.status === 'auto')
    const selected = result ? result.rows.filter(r => r.path && actionable(r) && choices[r.path]?.selected && choices[r.path]?.to.trim()) : []

    const save = async () => {
        if (!selected.length) return
        setBusy(true)
        setMessage(null)
        try {
            const d = await send(API, 'POST', { items: selected.map(r => ({ from: r.path, to: choices[r.path!].to.trim(), note: 'Search Console listesinden' })) })
            // Re-check the list (saved rows now show "Zaten yönlendirilmiş"), then show this save's outcome
            await check()
            setErrors(Array.isArray(d.errors) ? d.errors : [])
            setMessage({ kind: 'ok', text: `${d.saved} yönlendirme kaydedildi.${d.errors?.length ? ` ${d.errors.length} adres kaydedilemedi (aşağıda).` : ''}` })
        } catch (e) {
            setMessage({ kind: 'error', text: (e as Error).message })
        } finally {
            setBusy(false)
        }
    }

    const counts = result ? STATUS_ORDER.map(s => [s, result.rows.filter(r => r.status === s).length] as const).filter(([, n]) => n > 0) : []

    return (
        <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                <p className="text-sm text-slate-600">
                    Google Search Console’da <b>Sayfalar › Bulunamadı (404)</b> listesini açın, <b>Dışa aktar › CSV indir</b> deyin.
                    İnen zip dosyasını açıp içindeki <b>Tablo.csv</b> (ya da Table.csv) dosyasını aşağıdan seçin. İsterseniz adresleri
                    alt alta yapıştırabilirsiniz. Liste yalnızca kontrol edilir; siz onaylamadan hiçbir şey kaydedilmez.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                    <label className={`${secondaryBtn} cursor-pointer`}>
                        <FileUp className="w-4 h-4" /> CSV dosyası seç
                        <input type="file" accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={e => readFile(e.target.files?.[0])} />
                    </label>
                    {fileName && <span className="text-sm text-slate-500">{fileName}</span>}
                </div>
                <textarea
                    value={text}
                    onChange={e => { setText(e.target.value); setFileName('') }}
                    rows={6}
                    placeholder={'https://onopostore.com/urun/eski-urun-adi\nhttps://onopostore.com/eski-sayfa.html'}
                    className={`${inputClass} font-mono text-xs`}
                />
                <button type="button" onClick={check} disabled={busy || !text.trim()} className={primaryBtn}>
                    {busy ? 'Kontrol ediliyor...' : 'Listeyi kontrol et'}
                </button>
            </div>

            {message && (
                <p className={`rounded-lg px-3 py-2 text-sm ${message.kind === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
            )}
            {errors.length > 0 && (
                <ul className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 space-y-1">
                    {errors.map(e => <li key={e.from}><span className="font-mono break-all">{e.from}</span>: {e.error}</li>)}
                </ul>
            )}

            {result && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-100 text-sm">
                        <span className="font-medium text-slate-900">{result.total} adres</span>
                        {counts.map(([s, n]) => <span key={s} className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_TEXT[s].className}`}>{STATUS_TEXT[s].label}: {n}</span>)}
                        {result.truncated && <span className="text-xs text-amber-700">İlk 1000 adres kontrol edildi.</span>}
                        {result.foreign > 0 && <span className="text-xs text-slate-500">{result.foreign} başka site adresi atlandı.</span>}
                    </div>
                    <ul className="divide-y divide-slate-100">
                        {result.rows.map(r => {
                            const st = STATUS_TEXT[r.status]
                            const c = r.path ? choices[r.path] : undefined
                            const canAct = actionable(r)
                            return (
                                <li key={r.path ?? r.input} className="px-4 py-3">
                                    <div className="flex flex-wrap items-start gap-2">
                                        {canAct && c && (
                                            <input
                                                type="checkbox"
                                                checked={c.selected}
                                                onChange={e => setChoice(r.path!, { selected: e.target.checked })}
                                                className="mt-1 h-4 w-4"
                                                aria-label="Bu adresi yönlendir"
                                            />
                                        )}
                                        <span className="font-mono text-xs text-slate-900 break-all flex-1 min-w-[200px]">{r.path ?? r.input}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.className}`}>{st.label}</span>
                                    </div>
                                    {r.status === 'has-redirect' && r.current && (
                                        <p className="mt-1 text-sm text-slate-600">Gittiği yer: <TargetLink target={r.current} /></p>
                                    )}
                                    {r.status === 'auto' && r.suggestions[0] && (
                                        <p className="mt-1 text-sm text-slate-600">Gittiği yer: <TargetLink target={r.suggestions[0].target} label={r.suggestions[0].label} /></p>
                                    )}
                                    {canAct && c && (r.status !== 'auto' || c.selected) && (
                                        <div className="mt-2 flex flex-wrap gap-2 items-center">
                                            {r.suggestions.filter(s => s.kind === 'suggested').length > 0 && (
                                                <select
                                                    value={r.suggestions.some(s => s.target === c.to) ? c.to : ''}
                                                    onChange={e => setChoice(r.path!, { to: e.target.value, selected: !!e.target.value || c.selected })}
                                                    className="p-2 border border-slate-200 rounded-lg text-sm max-w-full"
                                                >
                                                    <option value="">Başka adres yazacağım</option>
                                                    {r.suggestions.filter(s => s.kind === 'suggested').map(s => (
                                                        <option key={s.target} value={s.target}>{s.label}</option>
                                                    ))}
                                                </select>
                                            )}
                                            {!r.suggestions.some(s => s.kind === 'suggested' && s.target === c.to) && (
                                                <input
                                                    value={c.to}
                                                    onChange={e => setChoice(r.path!, { to: e.target.value, selected: !!e.target.value.trim() })}
                                                    placeholder="Yeni adres: /urun-adi/"
                                                    className={`${inputClass} flex-1 min-w-[200px]`}
                                                />
                                            )}
                                            {c.to && r.suggestions.some(s => s.target === c.to) && <TargetLink target={c.to} />}
                                        </div>
                                    )}
                                    {r.status === 'auto' && c && !c.selected && (
                                        <button type="button" onClick={() => setChoice(r.path!, { selected: true, to: r.suggestions[0]?.target ?? '' })} className="mt-1 text-xs text-slate-500 hover:underline">
                                            Yine de kalıcı yönlendirme olarak kaydet
                                        </button>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                    <div className="flex flex-wrap items-center gap-3 justify-between px-4 py-3 border-t border-slate-100">
                        <span className="text-sm text-slate-500">{selected.length} adres seçildi</span>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setResult(null)} className={secondaryBtn}><X className="w-4 h-4" /> Temizle</button>
                            <button type="button" onClick={save} disabled={busy || !selected.length} className={primaryBtn}>
                                <Check className="w-4 h-4" /> Seçilenleri yönlendir ({selected.length})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ---- Page -----------------------------------------------------------------------------------------------

type Tab = 'not-found' | 'redirects' | 'import'

export default function AdminRedirectsPage() {
    // Each tab loads its data when it is opened (tabs are mounted only while shown), so a change made in one
    // tab is always visible in the next
    const [tab, setTab] = React.useState<Tab>('not-found')

    const tabs: Array<{ key: Tab; label: string }> = [
        { key: 'not-found', label: 'Bulunamayan sayfalar' },
        { key: 'redirects', label: 'Yönlendirmeler' },
        { key: 'import', label: 'Search Console listesini yükle' },
    ]

    return (
        <div className="space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Yönlendirmeler</h1>
                <p className="text-sm text-slate-500 mt-1 max-w-3xl">
                    Google’da ya da eski bağlantılarda kalan, artık açılmayan adresleri doğru sayfaya gönderir. Site eski ürün,
                    kategori ve görsel adreslerinin çoğunu kendisi bulup yönlendirir; emin olamadıklarını burada görürsünüz.
                </p>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-slate-200">
                {tabs.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        onClick={() => setTab(t.key)}
                        className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${tab === t.key ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'not-found' && <NotFoundTab />}
            {tab === 'redirects' && <RedirectsTab />}
            {tab === 'import' && <ImportTab />}
        </div>
    )
}
