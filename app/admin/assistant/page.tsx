'use client'

/**
 * Admin › AI Asistan (SPEC 8.7): the kill switch, the WhatsApp number the chat cards use, shipping and
 * support facts the assistant may state, owner-approved campaigns, the daily budget and the usage of the
 * last 7 days. Values are site_settings keys saved through the existing POST /api/site-settings (which
 * also bumps cache_version, so the storefront picks up the switch). Only changed keys are sent.
 * No chat text exists anywhere, so none is shown.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Sparkles, MessageCircle, Truck, Megaphone, Wallet, BarChart3 } from 'lucide-react'
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
    modelCalls: number
    costUsd: number
    outcomes: { fallback: number; busy: number; error: number; timeout: number; blocked: number }
    handoffs: number
    addToCart: number
    waClicks: number
    firstTextP50: number | null
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
            .then(d => setUsage(Array.isArray(d?.days) ? d.days : []))
            .catch(() => setUsageError(true))
    }, [])

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
        (a, d) => ({ turns: a.turns + d.turns, calls: a.calls + d.modelCalls, cost: a.cost + d.costUsd }),
        { turns: 0, calls: 0, cost: 0 },
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

                <Section icon={BarChart3} title="Kullanım (son 7 gün)">
                    {usageError && <p className="text-sm text-red-600">Kullanım verisi alınamadı.</p>}
                    {!usageError && !usage && <p className="text-sm text-slate-500">Yükleniyor...</p>}
                    {usage && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-slate-500 border-b">
                                        <th scope="col" className="py-2 pr-3 font-medium">Gün</th>
                                        <th scope="col" className="py-2 pr-3 font-medium text-right">Tur</th>
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
