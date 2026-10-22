'use client'

/**
 * Admin › AI Asistan › Sohbetler: what visitors asked the Onopo Asistan and what it answered.
 *
 * - List (newest first, 30 a page) with a date range and a text search; export of the same filters as CSV
 *   (opens in Excel with Turkish letters) or JSON, for reading the questions months later.
 * - Detail: a real preview of the conversation, drawn with the chat's own card components
 *   (components/assistant/parts, used read-only) so the admin sees exactly the cards the visitor saw.
 *   Every button and link inside the preview is disabled (no cart adds, no WhatsApp, no beacons).
 * - Delete one conversation (with a confirmation).
 *
 * Data: the conversation API of the assistant package (shared contract):
 *   GET    /api/admin/assistant/conversations/?from&to&q&page
 *   GET    /api/admin/assistant/conversations/<id>/
 *   DELETE /api/admin/assistant/conversations/<id>/
 *   GET    /api/admin/assistant/conversations/export/?format=csv|json&from&to(&q)
 */
import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight, Download, MessageCircle, Search, Trash2, X } from 'lucide-react'
import type { AssistantEvent, Suggestion } from '@/lib/assistant/contract'
import { AssistantUiContext, type AssistantChat, type AssistantUi } from '@/components/assistant/useAssistantChat'
import { MiniMarkdown } from '@/components/assistant/MiniMarkdown'
import { ProductCards } from '@/components/assistant/parts/ProductCards'
import { CompareCard } from '@/components/assistant/parts/CompareCard'
import { LinkCards } from '@/components/assistant/parts/LinkCards'
import { StoreInfoCard } from '@/components/assistant/parts/StoreInfoCard'
import { WhatsAppCard } from '@/components/assistant/parts/WhatsAppCard'
import { ChipRow } from '@/components/assistant/parts/EmptyState'
import { useShippingSettings } from '@/components/layout/store-data'

// ---- Shared contract types --------------------------------------------------------------------------

interface ConversationSummary {
    id: string
    startedAt: string
    lastAt: string
    turns: number
    firstMessage: string
    device: string | null
    page: string | null
    waShown: boolean
    productIds: number[]
    outcome: 'ok' | 'error' | 'busy' | 'mixed'
}
type PreviewEvent = Extract<AssistantEvent, { t: 'products' | 'compare' | 'links' | 'store_info' | 'whatsapp' | 'suggestions' }>
interface TranscriptMessage {
    role: 'user' | 'assistant'
    text: string
    events: PreviewEvent[]
    at: string
}
interface ListResponse { rows: ConversationSummary[]; total: number; page: number; pageSize: number }

const API = '/api/admin/assistant/conversations/'

// ---- Helpers ----------------------------------------------------------------------------------------

/** Istanbul 'YYYY-MM-DD' of a Date (Turkey is UTC+3 all year). */
function istanbulDate(d: Date): string {
    return new Date(d.getTime() + 3 * 3600_000).toISOString().slice(0, 10)
}

/** Parses ISO strings and SQLite's 'YYYY-MM-DD HH:MM:SS' (UTC) alike. */
function parseTime(s: string | null | undefined): Date | null {
    if (!s) return null
    const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s) ? `${s.replace(' ', 'T')}Z` : s
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d
}

function formatTime(s: string | null | undefined, withDate = true): string {
    const d = parseTime(s)
    if (!d) return '—'
    return d.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        ...(withDate ? { day: 'numeric', month: 'short' } : {}),
        hour: '2-digit',
        minute: '2-digit',
    })
}

const OUTCOME: Record<ConversationSummary['outcome'], { label: string; className: string }> = {
    ok: { label: 'Yanıtlandı', className: 'bg-green-50 text-green-700' },
    mixed: { label: 'Kısmen hata', className: 'bg-amber-50 text-amber-700' },
    busy: { label: 'Yoğunluk', className: 'bg-amber-50 text-amber-700' },
    error: { label: 'Hata', className: 'bg-red-50 text-red-700' },
}

// ---- Preview: the chat as the visitor saw it ---------------------------------------------------------

const noop = () => {}
const PREVIEW_CHAT: AssistantChat = {
    messages: [],
    streaming: false,
    waBase: null, // hides the "WhatsApp'tan sor" extras; cards bring their own link
    offline: false,
    blockedUntil: 0,
    addedFromChat: false,
    announcement: '',
    send: noop,
    stop: noop,
    retry: noop,
    newChat: noop,
    insertWhatsapp: noop,
    beacon: noop,
    noteAddToCart: noop,
    restoredIds: new Set<string>(),
}

/** Blocks every click inside the preview (links, Sepete Ekle, WhatsApp) while scrolling still works. */
function blockActions(e: React.SyntheticEvent) {
    const target = e.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select, label')) {
        e.preventDefault()
        e.stopPropagation()
    }
}

function PreviewMessage({ m }: { m: TranscriptMessage }) {
    if (m.role === 'user') {
        return (
            <div className="flex flex-col items-end gap-1">
                <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-[15px] leading-[22px] text-white">
                    {m.text}
                </p>
                <span className="text-[11px] text-slate-400">{formatTime(m.at, false)}</span>
            </div>
        )
    }
    const events = Array.isArray(m.events) ? m.events : []
    const whatsapp = events.find((e): e is Extract<PreviewEvent, { t: 'whatsapp' }> => e.t === 'whatsapp')
    const suggestions = [...events].reverse().find((e): e is Extract<PreviewEvent, { t: 'suggestions' }> => e.t === 'suggestions')
    const chips: Suggestion[] = suggestions?.chips?.slice(0, 3) ?? []
    return (
        <div className="min-w-0">
            {m.text && <MiniMarkdown text={m.text} />}
            {events.map((c, i) => {
                const card =
                    c.t === 'products' ? <ProductCards card={c} />
                        : c.t === 'compare' ? <CompareCard card={c} />
                            : c.t === 'links' ? <LinkCards items={c.items} />
                                : c.t === 'store_info' ? <StoreInfoCard rows={c.rows} href={c.href} />
                                    : null
                return card ? <div key={i} className="mt-3">{card}</div> : null
            })}
            {whatsapp && (
                <div className="mt-3">
                    <WhatsAppCard card={whatsapp} beaconShown={false} />
                </div>
            )}
            {chips.length > 0 && (
                <div className="mt-3">
                    <ChipRow chips={chips} onChip={noop} size="follow" />
                </div>
            )}
            <span className="mt-1 block text-[11px] text-slate-400">{formatTime(m.at, false)}</span>
        </div>
    )
}

function ChatPreview({ messages }: { messages: TranscriptMessage[] }) {
    const shipping = useShippingSettings()
    const ui: AssistantUi = React.useMemo(
        () => ({ chat: PREVIEW_CHAT, isSheet: false, freeThreshold: shipping?.freeShippingThreshold ?? 0, onNavigate: noop }),
        [shipping?.freeShippingThreshold],
    )
    return (
        <AssistantUiContext.Provider value={ui}>
            <div
                onClickCapture={blockActions}
                onSubmitCapture={blockActions}
                className="mx-auto w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
                <div className="flex h-12 items-center gap-2 border-b border-slate-100 px-4 text-sm font-semibold text-slate-900">
                    <MessageCircle className="h-4 w-4 text-slate-500" />
                    Onopo Asistan
                    <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Önizleme</span>
                </div>
                <div className="space-y-5 px-4 py-4">
                    {messages.length ? messages.map((m, i) => <PreviewMessage key={i} m={m} />) : (
                        <p className="text-sm text-slate-500">Bu sohbette mesaj yok.</p>
                    )}
                </div>
            </div>
        </AssistantUiContext.Provider>
    )
}

// ---- Detail -----------------------------------------------------------------------------------------

function Detail({ id, onClose, onDeleted }: { id: string; onClose: () => void; onDeleted: (id: string) => void }) {
    const [data, setData] = React.useState<{ summary: ConversationSummary; messages: TranscriptMessage[] } | null>(null)
    const [state, setState] = React.useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
    const [deleting, setDeleting] = React.useState(false)

    React.useEffect(() => {
        let alive = true
        setState('loading')
        setData(null)
        fetch(`${API}${encodeURIComponent(id)}/`, { cache: 'no-store' })
            .then(async r => {
                if (!alive) return
                if (r.status === 404) return setState('missing')
                if (!r.ok) return setState('error')
                setData(await r.json())
                setState('ok')
            })
            .catch(() => alive && setState('error'))
        return () => { alive = false }
    }, [id])

    const remove = async () => {
        if (!confirm('Bu sohbet kalıcı olarak silinsin mi? Geri alınamaz.')) return
        setDeleting(true)
        try {
            const r = await fetch(`${API}${encodeURIComponent(id)}/`, { method: 'DELETE' })
            if (!r.ok) throw new Error(String(r.status))
            onDeleted(id)
        } catch {
            alert('Sohbet silinemedi. Tekrar dene.')
        } finally {
            setDeleting(false)
        }
    }

    const s = data?.summary
    return (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 md:p-5">
            <div className="flex items-start gap-2 mb-4">
                <button type="button" onClick={onClose} className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-200" aria-label="Listeye dön">
                    <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <h2 className="font-bold text-slate-900">Sohbet</h2>
                    {s && (
                        <p className="text-xs text-slate-500 mt-0.5">
                            {formatTime(s.startedAt)} · {s.turns} mesaj
                            {s.device ? ` · ${s.device}` : ''}
                            {s.page ? ` · ${s.page}` : ''}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={remove}
                    disabled={deleting || state !== 'ok'}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? 'Siliniyor…' : 'Sil'}
                </button>
                <button type="button" onClick={onClose} className="hidden lg:block p-2 rounded-lg hover:bg-slate-200" aria-label="Kapat">
                    <X className="w-5 h-5" />
                </button>
            </div>
            {state === 'loading' && <p className="text-sm text-slate-500 py-8 text-center">Yükleniyor...</p>}
            {state === 'missing' && <p className="text-sm text-slate-500 py-8 text-center">Bu sohbet bulunamadı (silinmiş olabilir).</p>}
            {state === 'error' && <p className="text-sm text-red-600 py-8 text-center">Sohbet yüklenemedi.</p>}
            {state === 'ok' && data && (
                <>
                    <p className="text-xs text-slate-500 mb-3">Ziyaretçinin gördüğü haliyle. Önizlemedeki düğmeler çalışmaz.</p>
                    <ChatPreview messages={data.messages} />
                </>
            )}
        </div>
    )
}

// ---- Page -------------------------------------------------------------------------------------------

export default function AdminConversationsPage() {
    const today = istanbulDate(new Date())
    const [from, setFrom] = React.useState(() => istanbulDate(new Date(Date.now() - 29 * 86_400_000)))
    const [to, setTo] = React.useState(today)
    const [qInput, setQInput] = React.useState('')
    const [q, setQ] = React.useState('')
    const [page, setPage] = React.useState(1)
    const [list, setList] = React.useState<ListResponse | null>(null)
    const [state, setState] = React.useState<'loading' | 'ok' | 'error'>('loading')
    const [selected, setSelected] = React.useState<string | null>(null)
    const [reload, setReload] = React.useState(0)

    React.useEffect(() => {
        let alive = true
        setState('loading')
        const params = new URLSearchParams({ from, to, page: String(page) })
        if (q) params.set('q', q)
        fetch(`${API}?${params}`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((d: ListResponse) => {
                if (!alive) return
                setList({ rows: Array.isArray(d.rows) ? d.rows : [], total: Number(d.total) || 0, page: Number(d.page) || 1, pageSize: Number(d.pageSize) || 30 })
                setState('ok')
            })
            .catch(() => alive && setState('error'))
        return () => { alive = false }
    }, [from, to, q, page, reload])

    const exportHref = (format: 'csv' | 'json') => {
        const params = new URLSearchParams({ format, from, to })
        if (q) params.set('q', q)
        return `${API}export/?${params}`
    }

    const pages = list ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1
    const onDeleted = (id: string) => {
        setSelected(null)
        setList(l => (l ? { ...l, rows: l.rows.filter(r => r.id !== id), total: Math.max(0, l.total - 1) } : l))
        setReload(n => n + 1)
    }

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-3 justify-between">
                <div>
                    <Link href="/admin/assistant" prefetch={false} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900">
                        <ArrowLeft className="w-4 h-4" /> AI Asistan
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900 mt-1">Sohbetler</h1>
                    <p className="text-sm text-slate-500 mt-1">Ziyaretçilerin asistana ne sorduğu ve asistanın ne cevap verdiği.</p>
                </div>
                <div className="flex gap-2">
                    <a href={exportHref('csv')} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                        <Download className="w-4 h-4" /> Dışa aktar (Excel)
                    </a>
                    <a href={exportHref('json')} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                        <Download className="w-4 h-4" /> JSON
                    </a>
                </div>
            </div>

            <form
                onSubmit={e => { e.preventDefault(); setPage(1); setQ(qInput.trim()) }}
                className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-slate-200 p-4"
            >
                <label className="text-sm">
                    <span className="block text-xs font-medium text-slate-500 mb-1">Başlangıç</span>
                    <input type="date" value={from} max={to} onChange={e => { setPage(1); setFrom(e.target.value) }} className="p-2 border border-slate-200 rounded-lg" />
                </label>
                <label className="text-sm">
                    <span className="block text-xs font-medium text-slate-500 mb-1">Bitiş</span>
                    <input type="date" value={to} min={from} max={today} onChange={e => { setPage(1); setTo(e.target.value) }} className="p-2 border border-slate-200 rounded-lg" />
                </label>
                <label className="text-sm flex-1 min-w-[200px]">
                    <span className="block text-xs font-medium text-slate-500 mb-1">Mesajlarda ara</span>
                    <span className="flex gap-2">
                        <input
                            type="search"
                            value={qInput}
                            onChange={e => setQInput(e.target.value)}
                            placeholder="ör. kargo, iPhone 15, iade"
                            className="flex-1 p-2 border border-slate-200 rounded-lg"
                        />
                        <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-sm font-medium text-slate-700 hover:bg-slate-200">
                            <Search className="w-4 h-4" /> Ara
                        </button>
                    </span>
                </label>
            </form>

            <div className={`grid gap-5 ${selected ? 'lg:grid-cols-[minmax(0,1fr)_460px]' : ''}`}>
                <div className={`bg-white rounded-xl border border-slate-200 overflow-hidden ${selected ? 'hidden lg:block' : ''}`}>
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 text-sm text-slate-500">
                        <span>{list ? `${list.total} sohbet` : ' '}</span>
                        {state === 'loading' && <span>Yükleniyor...</span>}
                    </div>
                    {state === 'error' && (
                        <p className="p-6 text-sm text-red-600">Sohbetler yüklenemedi. Sayfayı yenileyip tekrar dene.</p>
                    )}
                    {state !== 'error' && list && list.rows.length === 0 && state === 'ok' && (
                        <p className="p-6 text-sm text-slate-500">{q ? 'Aramaya uyan sohbet yok.' : 'Bu tarihlerde sohbet yok.'}</p>
                    )}
                    {list && list.rows.length > 0 && (
                        <ul className="divide-y divide-slate-100">
                            {list.rows.map(r => {
                                const o = OUTCOME[r.outcome] ?? OUTCOME.ok
                                return (
                                    <li key={r.id}>
                                        <button
                                            type="button"
                                            onClick={() => setSelected(r.id)}
                                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${selected === r.id ? 'bg-blue-50' : ''}`}
                                        >
                                            <span className="flex items-center gap-2 text-xs text-slate-500">
                                                <span>{formatTime(r.lastAt || r.startedAt)}</span>
                                                <span>·</span>
                                                <span>{r.turns} mesaj</span>
                                                {r.productIds?.length > 0 && <><span>·</span><span>{r.productIds.length} ürün gösterildi</span></>}
                                                {r.device && <><span>·</span><span className="truncate max-w-[140px]">{r.device}</span></>}
                                                <span className="ml-auto flex items-center gap-1.5">
                                                    {r.waShown && <span className="rounded-full bg-green-50 px-2 py-0.5 font-medium text-green-700">WhatsApp</span>}
                                                    {r.outcome !== 'ok' && <span className={`rounded-full px-2 py-0.5 font-medium ${o.className}`}>{o.label}</span>}
                                                </span>
                                            </span>
                                            <span className="mt-1 block text-sm text-slate-900 line-clamp-2">{r.firstMessage || '—'}</span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                    {list && pages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
                            <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40">
                                <ChevronLeft className="w-4 h-4" /> Önceki
                            </button>
                            <span className="text-slate-500">{page} / {pages}</span>
                            <button type="button" disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-slate-100 disabled:opacity-40">
                                Sonraki <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>

                {selected && <Detail key={selected} id={selected} onClose={() => setSelected(null)} onDeleted={onDeleted} />}
            </div>
        </div>
    )
}
