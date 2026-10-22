'use client'

/**
 * Admin › AI Asistan (SPEC 8.7): the kill switch, the WhatsApp number the chat cards use, shipping and
 * support facts the assistant may state, owner-approved campaigns, the daily budget and the usage of the
 * last 7 days. Values are site_settings keys saved through the existing POST /api/site-settings (which
 * also bumps cache_version, so the storefront picks up the switch). Only changed keys are sent.
 * Also here: how many conversations were stored (the transcripts themselves are on
 * /admin/assistant/sohbetler/), the product facts lines (written automatically; a button hurries the missing ones), and the
 * popular-question chips of the empty chat (weekly analysis, "Şimdi analiz et", edit or clear them).
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Save, Sparkles, MessageCircle, Truck, Megaphone, Wallet, BarChart3, MessagesSquare, PackageSearch, Download, RefreshCw, Lightbulb } from 'lucide-react'
import { waBaseOf } from '@/lib/assistant/tools'

const KEYS = ['ai_assistant_enabled', 'ai_whatsapp_number', 'ai_ship_days', 'ai_ship_cutoff', 'ai_support_hours', 'ai_campaigns', 'ai_daily_budget_usd'] as const
type Key = (typeof KEYS)[number]
type Values = Record<Key, string>

const DEFAULTS: Values = {
    ai_assistant_enabled: 'false',
    ai_whatsapp_number: '',
    ai_ship_days: 'hafta-ici',
    ai_ship_cutoff: '18:00',
    ai_support_hours: '',
    ai_campaigns: '',
    ai_daily_budget_usd: '3',
}

interface UsageDay {
    day: string
    turns: number
    conversations?: number
    modelCalls: number
    costUsd: number
    outcomes: { fallback: number; busy: number; error: number; timeout: number; blocked: number }
    handoffs: number
    addToCart: number
    waClicks: number
    firstTextP50: number | null
}

interface ConversationCounts {
    today: number
    last7: number
    last30: number
    total: number
    messages30: number
}

interface FactsStatus {
    total: number
    ready: number
    missing: number
}

interface PopularState {
    questions: string[]
    meta: { at: string; source: 'auto' | 'admin'; messages: number } | null
}

const POPULAR_STATUS: Record<string, string> = {
    updated: 'Sorular güncellendi.',
    unchanged: 'Analiz yapıldı; sorular aynı kaldı.',
    too_few: 'Son 7 günde yeterli mesaj yok (en az 20); mevcut sorular korundu.',
    no_valid: 'Model uygun soru bulamadı; mevcut sorular korundu.',
    model_error: 'Yapay zekâ şu an cevap vermedi; mevcut sorular korundu.',
    budget: 'Bugünkü bütçe dolu; analiz yarın tekrar denenebilir.',
}

function formatIstanbul(iso: string): string {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    return d.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'medium', timeStyle: 'short' })
}

const CAMPAIGNS_MAX = 600

function Section({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                </span>
                {title}
            </h2>
            <div className="space-y-4">{children}</div>
        </div>
    )
}

export default function AdminAssistantPage() {
    const router = useRouter()
    const [loading, setLoading] = React.useState(true)
    const [saving, setSaving] = React.useState(false)
    const [values, setValues] = React.useState<Values>(DEFAULTS)
    const [saved, setSaved] = React.useState<Values>(DEFAULTS)
    /** whatsapp_number and footer_phone from Site Ayarları: the fallbacks when no assistant number is set */
    const [siteNumbers, setSiteNumbers] = React.useState<string[]>([])
    const [usage, setUsage] = React.useState<UsageDay[] | null>(null)
    const [usageError, setUsageError] = React.useState(false)
    const [counts, setCounts] = React.useState<ConversationCounts | null>(null)
    const [facts, setFacts] = React.useState<FactsStatus | null>(null)
    const [factsBusy, setFactsBusy] = React.useState(false)
    const [factsNote, setFactsNote] = React.useState('')
    const [popular, setPopular] = React.useState<PopularState | null>(null)
    const [popularDraft, setPopularDraft] = React.useState<string[]>(['', '', ''])
    const [popularBusy, setPopularBusy] = React.useState(false)
    const [popularNote, setPopularNote] = React.useState('')

    React.useEffect(() => {
        fetch('/api/site-settings', { cache: 'no-store' })
            .then(r => r.json())
            .then((s: Record<string, string>) => {
                const next = { ...DEFAULTS }
                for (const k of KEYS) if (typeof s?.[k] === 'string') next[k] = s[k]
                setValues(next)
                setSaved(next)
                setSiteNumbers([s?.whatsapp_number ?? '', s?.footer_phone ?? ''])
            })
            .catch(() => {})
            .finally(() => setLoading(false))
        fetch('/api/admin/assistant/', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then(d => {
                setUsage(Array.isArray(d?.days) ? d.days : [])
                setCounts(d?.conversations ?? null)
            })
            .catch(() => setUsageError(true))
        fetch('/api/admin/assistant/facts/', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then(d => setFacts(d && typeof d.total === 'number' ? d : null))
            .catch(() => {})
        fetch('/api/admin/assistant/popular/', { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : null))
            .then((d: PopularState | null) => {
                if (!d || !Array.isArray(d.questions)) return
                setPopular({ questions: d.questions, meta: d.meta ?? null })
                setPopularDraft([0, 1, 2].map(i => d.questions[i] ?? ''))
            })
            .catch(() => {})
    }, [])

    function showPopular(d: PopularState) {
        setPopular({ questions: d.questions, meta: d.meta ?? null })
        setPopularDraft([0, 1, 2].map(i => d.questions[i] ?? ''))
    }

    /** "Şimdi analiz et": the weekly analysis on demand (a fraction of a cent, counted in today's budget). */
    const analyzePopular = async () => {
        setPopularBusy(true)
        setPopularNote('')
        try {
            const res = await fetch('/api/admin/assistant/popular/', { method: 'POST' })
            const d = await res.json().catch(() => null)
            if (!res.ok || !d) throw new Error(String(res.status))
            showPopular({ questions: Array.isArray(d.questions) ? d.questions : [], meta: d.meta ?? null })
            setPopularNote(POPULAR_STATUS[d.status] ?? 'Analiz tamamlandı.')
        } catch {
            setPopularNote('Analiz yapılamadı, lütfen tekrar dene.')
        } finally {
            setPopularBusy(false)
        }
    }

    /** Saves the admin's own list ([] clears it). */
    const savePopular = async (questions: string[]) => {
        setPopularBusy(true)
        setPopularNote('')
        const list = questions.map(q => q.trim()).filter(Boolean)
        try {
            const res = await fetch('/api/admin/assistant/popular/', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questions: list }),
            })
            const d = await res.json().catch(() => null)
            if (!res.ok || !d || !Array.isArray(d.questions)) {
                setPopularNote(typeof d?.error === 'string' ? d.error : 'Kaydedilemedi, lütfen tekrar dene.')
                return
            }
            showPopular(d)
            setPopularNote(list.length ? 'Sorular kaydedildi.' : 'Sorular temizlendi.')
        } catch {
            setPopularNote('Kaydedilemedi, lütfen tekrar dene.')
        } finally {
            setPopularBusy(false)
        }
    }

    /**
     * Fills the missing product facts lines until none is left. Each request works ~20 s at the server's pace
     * (one call every 4 s, retries on rate limits); a request that ended because the model was busy is
     * followed by a pause, not by giving up (it used to stop at 32/118). Products that failed are skipped in
     * the following requests and listed in Sistem kayıtları. Only a real error (quota, database) stops it.
     */
    const refreshFacts = async () => {
        setFactsBusy(true)
        setFactsNote('')
        let done = 0
        const failedIds: number[] = []
        let idleRounds = 0
        const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
        try {
            for (let i = 0; i < 200; i++) {
                const res = await fetch('/api/admin/assistant/facts/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ exclude: failedIds }),
                })
                const d = await res.json().catch(() => null)
                if (!res.ok || !d) throw new Error(String(res.status))
                done += Number(d.done) || 0
                for (const id of Array.isArray(d.failedIds) ? d.failedIds : []) if (!failedIds.includes(id)) failedIds.push(id)
                const remaining = Math.max(0, Number(d.remaining) || 0)
                setFacts({ total: d.total, ready: d.ready, missing: remaining })
                const left = Math.max(0, remaining - failedIds.length)
                if (left <= 0) break
                if (d.stopped === 'quota' || d.stopped === 'db' || d.stopped === 'failures' || d.stopped === 'budget' || d.stopped === 'no_ai' || d.stopped === 'exception') {
                    const why = d.stopped === 'budget' ? 'günlük bütçe doldu' : d.stopped === 'quota' ? 'yapay zekânın günlük hakkı doldu' : 'bir hata oluştu (Sistem kayıtları sayfasına bak)'
                    setFactsNote(`${done} ürün yenilendi; durdu: ${why}.`)
                    return
                }
                // Nothing moved because the model was busy: wait a little longer each time, give up after a few minutes
                idleRounds = d.done > 0 ? 0 : idleRounds + 1
                if (idleRounds >= 8) {
                    setFactsNote(`${done} ürün yenilendi; yapay zekâ çok yoğun. Kalanlar her gün otomatik tamamlanır.`)
                    return
                }
                setFactsNote(`${done} ürün güncellendi, ${left} kaldı...${idleRounds ? ' (yapay zekâ yoğun, bekleniyor)' : ''}`)
                if (idleRounds) await pause(Math.min(60_000, 10_000 * idleRounds))
            }
            const failNote = failedIds.length ? ` ${failedIds.length} ürünün bilgisi yazılamadı (Sistem kayıtları).` : ''
            setFactsNote(done || failedIds.length ? `${done} ürünün bilgisi yenilendi.${failNote}` : 'Yenilenecek ürün yok.')
        } catch {
            setFactsNote(done ? `${done} ürün yenilendi; kalanlar için tekrar dene.` : 'Yenilenemedi, lütfen tekrar dene.')
        } finally {
            setFactsBusy(false)
        }
    }

    const set = (k: Key, v: string) => setValues(prev => ({ ...prev, [k]: v }))
    const enabled = values.ai_assistant_enabled === 'true'
    const effectiveNumber = [values.ai_whatsapp_number, ...siteNumbers].find(n => waBaseOf(n)) ?? null
    const ownNumberInvalid = values.ai_whatsapp_number.trim() !== '' && !waBaseOf(values.ai_whatsapp_number)
    const budget = parseFloat(values.ai_daily_budget_usd.replace(',', '.'))
    const budgetInvalid = !Number.isFinite(budget) || budget < 0.5 || budget > 50
    const cutoffInvalid = !/^([01]\d|2[0-3]):[0-5]\d$/.test(values.ai_ship_cutoff)
    const changed = KEYS.filter(k => values[k] !== saved[k])

    const save = async (e: React.FormEvent) => {
        e.preventDefault()
        if (budgetInvalid || cutoffInvalid || ownNumberInvalid || changed.length === 0) return
        setSaving(true)
        try {
            const body: Partial<Values> = {}
            for (const k of changed) body[k] = k === 'ai_campaigns' ? values[k].trim().slice(0, CAMPAIGNS_MAX) : values[k].trim()
            const res = await fetch('/api/site-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error(String(res.status))
            setSaved({ ...values, ...body })
            setValues(v => ({ ...v, ...body }))
            alert('Asistan ayarları kaydedildi')
        } catch {
            alert('Kaydedilemedi, lütfen tekrar deneyin')
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Yükleniyor...</div>

    const totals = (usage ?? []).reduce(
        (a, d) => ({ turns: a.turns + d.turns, conversations: a.conversations + (d.conversations ?? 0), calls: a.calls + d.modelCalls, cost: a.cost + d.costUsd }),
        { turns: 0, conversations: 0, calls: 0, cost: 0 },
    )

    return (
        <form onSubmit={save} className="max-w-4xl mx-auto pb-10">
            <div className="mb-6 flex items-center gap-4">
                <Button type="button" variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Geri
                </Button>
                <h1 className="text-2xl font-bold">AI Asistan</h1>
            </div>

            <div className="grid gap-8">
                <Section icon={Sparkles} title="Durum">
                    <label className="flex items-center justify-between gap-4 cursor-pointer">
                        <span>
                            <span className="block text-sm font-medium">Asistan sitede açık</span>
                            <span className="block text-xs text-slate-500">Kapalıyken sitede asistan düğmesi görünmez.</span>
                        </span>
                        <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={enabled}
                            onChange={e => set('ai_assistant_enabled', e.target.checked ? 'true' : 'false')}
                        />
                    </label>
                    {!effectiveNumber && (
                        <p className="text-sm text-red-600">WhatsApp numarası yok: WhatsApp kartları gösterilmez.</p>
                    )}
                </Section>

                <Section icon={MessageCircle} title="WhatsApp">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="ai-wa">Mağaza WhatsApp numarası</label>
                        <p className="text-xs text-slate-500 mb-2">
                            Ürüne özel WhatsApp numarası varsa o kullanılır. Boş bırakırsan Site Ayarları&apos;ndaki WhatsApp ya da telefon numarası (cep telefonuysa) kullanılır.
                        </p>
                        <input
                            id="ai-wa"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            value={values.ai_whatsapp_number}
                            onChange={e => set('ai_whatsapp_number', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            placeholder="05xx xxx xx xx"
                        />
                        {ownNumberInvalid && <p className="mt-1 text-xs text-red-600">Bu bir cep telefonu numarası değil; WhatsApp için 05 ile başlayan bir numara gir.</p>}
                    </div>
                </Section>

                <Section icon={Truck} title="Kargo ve destek">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="ai-days">Kargo günleri</label>
                        <select id="ai-days" value={values.ai_ship_days} onChange={e => set('ai_ship_days', e.target.value)} className="w-full p-2 border rounded-lg bg-white">
                            <option value="hafta-ici">Hafta içi</option>
                            <option value="hafta-ici-cumartesi">Hafta içi + Cumartesi</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="ai-cutoff">Aynı gün kargo son saat</label>
                        <input id="ai-cutoff" type="time" value={values.ai_ship_cutoff} onChange={e => set('ai_ship_cutoff', e.target.value)} className="w-40 p-2 border rounded-lg" />
                        {cutoffInvalid && <p className="mt-1 text-xs text-red-600">Saati SS:DD biçiminde gir (örn. 18:00).</p>}
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="ai-hours">Destek saatleri</label>
                        <input
                            id="ai-hours"
                            type="text"
                            maxLength={80}
                            value={values.ai_support_hours}
                            onChange={e => set('ai_support_hours', e.target.value)}
                            className="w-full p-2 border rounded-lg"
                            placeholder="Hafta içi 09:00–18:00"
                        />
                    </div>
                </Section>

                <Section icon={Megaphone} title="Kampanyalar">
                    <p className="text-sm text-amber-700">
                        Yalnızca gerçekten geçerli kampanyaları yazın; asistan burada yazmayan indirim veya kupon söylemez.
                    </p>
                    <textarea
                        value={values.ai_campaigns}
                        maxLength={CAMPAIGNS_MAX}
                        onChange={e => set('ai_campaigns', e.target.value)}
                        className="w-full p-2 border rounded-lg h-28"
                        placeholder="Boş bırakılırsa asistan kampanya olmadığını bilir."
                    />
                    <p className="text-xs text-slate-500">{values.ai_campaigns.length} / {CAMPAIGNS_MAX}</p>
                </Section>

                <Section icon={Wallet} title="Bütçe">
                    <div>
                        <label className="block text-sm font-medium mb-1" htmlFor="ai-budget">Günlük üst sınır (USD)</label>
                        <p className="text-xs text-slate-500 mb-2">Aşılırsa asistan o gün gece yarısına kadar müşterileri WhatsApp&apos;a yönlendirir.</p>
                        <input
                            id="ai-budget"
                            type="number"
                            min={0.5}
                            max={50}
                            step={0.5}
                            value={values.ai_daily_budget_usd}
                            onChange={e => set('ai_daily_budget_usd', e.target.value)}
                            className="w-40 p-2 border rounded-lg"
                        />
                        {budgetInvalid && <p className="mt-1 text-xs text-red-600">0,5 ile 50 arasında bir değer gir.</p>}
                    </div>
                </Section>

                <Section icon={MessagesSquare} title="Sohbetler">
                    <p className="text-sm text-slate-600">
                        Müşterilerin asistanla yazışmaları, kişisel bilgiler gizlenmiş olarak 12 ay saklanır. Ne sorulduğunu görüp
                        siteyi ve asistanı buna göre geliştirebilirsin.
                    </p>
                    {counts ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                ['Bugün', counts.today],
                                ['Son 7 gün', counts.last7],
                                ['Son 30 gün', counts.last30],
                                ['Toplam (12 ay)', counts.total],
                            ].map(([label, n]) => (
                                <div key={label} className="rounded-lg border border-slate-200 p-3">
                                    <div className="text-xs text-slate-500">{label}</div>
                                    <div className="text-2xl font-semibold tabular-nums">{n}</div>
                                    <div className="text-xs text-slate-500">sohbet</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        !usageError && <p className="text-sm text-slate-500">{usage ? 'Henüz kayıtlı sohbet yok.' : 'Yükleniyor...'}</p>
                    )}
                    {counts && <p className="text-xs text-slate-500">Son 30 günde müşteriler {counts.messages30} mesaj yazdı.</p>}
                    <div className="flex flex-wrap gap-3">
                        <Link href="/admin/assistant/sohbetler/" className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                            <MessagesSquare className="w-4 h-4" /> Sohbet geçmişi
                        </Link>
                        <a href="/api/admin/assistant/conversations/export/?format=csv" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                            <Download className="w-4 h-4" /> Excel için indir (CSV)
                        </a>
                    </div>
                </Section>

                <Section icon={Lightbulb} title="Sık sorulan sorular">
                    <p className="text-sm text-slate-600">
                        Sohbet açıldığında &quot;Kargo bedava için ne eklesem?&quot; düğmesinin yanında gösterilen sorular. Her pazartesi son 7 günün
                        mesajlarına bakılarak en sık sorulan 3 soru otomatik seçilir; istersen kendin de yazabilir ya da temizleyebilirsin.
                    </p>
                    {popular?.meta && (
                        <p className="text-xs text-slate-500">
                            Son güncelleme: {formatIstanbul(popular.meta.at)} ·{' '}
                            {popular.meta.source === 'admin' ? 'elle düzenlendi' : `${popular.meta.messages} mesajdan otomatik`}
                        </p>
                    )}
                    {popular && popular.questions.length === 0 && <p className="text-sm text-slate-500">Şu an gösterilen soru yok.</p>}
                    <div className="space-y-2">
                        {popularDraft.map((q, i) => (
                            <div key={i}>
                                <label className="sr-only" htmlFor={`ai-popular-${i}`}>{`Soru ${i + 1}`}</label>
                                <input
                                    id={`ai-popular-${i}`}
                                    type="text"
                                    maxLength={32}
                                    value={q}
                                    onChange={e => setPopularDraft(d => d.map((x, j) => (j === i ? e.target.value : x)))}
                                    className="w-full p-2 border rounded-lg"
                                    placeholder={['Örn. iPhone 15 için şarj aleti', 'Örn. Seramik ile 9D farkı ne?', 'Örn. Hızlı şarj kablosu öner'][i]}
                                />
                            </div>
                        ))}
                        <p className="text-xs text-slate-500">En çok 32 karakter; numara, bağlantı ya da kişisel bilgi yazma.</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button type="button" variant="outline" onClick={analyzePopular} disabled={popularBusy}>
                            <RefreshCw className={`w-4 h-4 mr-2${popularBusy ? ' animate-spin' : ''}`} /> Şimdi analiz et
                        </Button>
                        <Button type="button" variant="outline" onClick={() => savePopular(popularDraft)} disabled={popularBusy}>
                            <Save className="w-4 h-4 mr-2" /> Soruları kaydet
                        </Button>
                        <Button type="button" variant="ghost" onClick={() => savePopular([])} disabled={popularBusy || !popular?.questions.length}>
                            Temizle
                        </Button>
                        {popularNote && <span className="text-sm text-slate-600" role="status">{popularNote}</span>}
                    </div>
                </Section>

                <Section icon={PackageSearch} title="Ürün bilgileri">
                    <p className="text-sm text-slate-600">
                        Asistan her ürünün açıklamasından kısa bir bilgi çıkarır (kutu içeriği, güç, hızlı şarj, kablo tipi, garanti) ve
                        sorulara buna göre cevap verir. Yeni eklediğin ya da adını veya açıklamasını değiştirdiğin ürünler kaydettiğin anda
                        kendiliğinden öğrenilir; kalanları her sabah otomatik tarama tamamlar. Düğmeye basman gerekmez; yalnızca hepsini
                        hemen yenilemek istersen kullan. Sorunlar Sistem kayıtları sayfasında görünür.
                    </p>
                    {facts && (
                        <p className="text-sm">
                            <span className="font-semibold tabular-nums">{facts.ready}</span> / {facts.total} ürün hazır
                            {facts.missing > 0 && <span className="text-amber-700"> · {facts.missing} ürün bekliyor (şimdilik açıklamadan otomatik özet kullanılıyor)</span>}
                        </p>
                    )}
                    <div className="flex items-center gap-3">
                        <Button type="button" variant="outline" onClick={refreshFacts} disabled={factsBusy}>
                            <RefreshCw className={`w-4 h-4 mr-2${factsBusy ? ' animate-spin' : ''}`} /> {factsBusy ? 'Yenileniyor...' : 'Ürün bilgilerini yenile'}
                        </Button>
                        {factsNote && <span className="text-sm text-slate-600" role="status">{factsNote}</span>}
                    </div>
                </Section>

                <Section icon={BarChart3} title="Kullanım (son 7 gün)">
                    {usageError && <p className="text-sm text-red-600">Kullanım verisi alınamadı.</p>}
                    {!usageError && !usage && <p className="text-sm text-slate-500">Yükleniyor...</p>}
                    {usage && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b">
                                        <th scope="col" className="py-2 pr-3 font-medium">Gün</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Sohbet</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Mesaj</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Model çağrısı</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Maliyet ($)</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">WhatsApp&apos;a yönlendirme</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Sepete ekleme</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Yedek model</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Hata</th>
                                        <th scope="col" className="py-2 font-medium text-right">İlk yanıt p50 (ms)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {usage.map(d => (
                                        <tr key={d.day} className="border-b last:border-0 tabular-nums">
                                            <td className="py-2 pr-3">{d.day}</td>
                                            <td className="py-2 pr-3 text-right">{d.conversations ?? '–'}</td>
                                            <td className="py-2 pr-3 text-right">{d.turns}</td>
                                            <td className="py-2 pr-3 text-right">{d.modelCalls}</td>
                                            <td className="py-2 pr-3 text-right">{d.costUsd.toFixed(3)}</td>
                                            <td className="py-2 pr-3 text-right">{d.handoffs}</td>
                                            <td className="py-2 pr-3 text-right">{d.addToCart}</td>
                                            <td className="py-2 pr-3 text-right">{d.outcomes.fallback}</td>
                                            <td className="py-2 pr-3 text-right">{d.outcomes.error + d.outcomes.timeout + d.outcomes.busy}</td>
                                            <td className="py-2 text-right">{d.firstTextP50 ?? '–'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-semibold tabular-nums">
                                        <td className="py-2 pr-3">Toplam</td>
                                        <td className="py-2 pr-3 text-right">{totals.conversations}</td>
                                        <td className="py-2 pr-3 text-right">{totals.turns}</td>
                                        <td className="py-2 pr-3 text-right">{totals.calls}</td>
                                        <td className="py-2 pr-3 text-right">{totals.cost.toFixed(3)}</td>
                                        <td colSpan={5} />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </Section>

                <div className="flex justify-end">
                    <Button type="submit" disabled={saving || changed.length === 0 || budgetInvalid || cutoffInvalid || ownNumberInvalid}>
                        <Save className="w-4 h-4 mr-2" /> {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </Button>
                </div>
            </div>
        </form>
    )
}
