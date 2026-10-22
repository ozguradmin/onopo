'use client'

/**
 * Admin › İstatistikler. Reads GET /api/analytics/stats/ (visits, visitors, chart, products, pages, devices,
 * sources, Onopo Asistan, orders per range; lib/analytics-db.ts) and GET /api/admin/dashboard-stats (all-time
 * sales lists). Visitors are counted without cookies (lib/analytics.ts): before that counting started only
 * page views exist, so those days show "—" for visitors.
 */
import * as React from 'react'
import Link from 'next/link'
import { Award, Bot, Calendar, CreditCard, ExternalLink, Globe, Monitor, Package, ShoppingCart, Smartphone, Tablet, TrendingUp } from 'lucide-react'

type RangeKey = 'today' | 'yesterday' | 'd7' | 'd30' | 'month'

interface RangeStats {
    key: RangeKey
    label: string
    from: string
    to: string
    views: number
    visitors: number | null
    approx: boolean
    partial: boolean
    orders: number
    revenue: number
}
interface DayCount { day: string; views: number; visitors: number | null }
interface AssistantRange { conversations: number; turns: number; handoffs: number; waClicks: number }
interface Stats {
    today: string
    since: string | null
    ranges: RangeStats[]
    daily: DayCount[]
    days: 7 | 30
    topProducts: Array<{ id: number; name: string; slug: string | null; active: boolean; views: number }>
    topPages: Array<{ path: string; views: number }>
    devices: Array<{ type: 'phone' | 'desktop' | 'tablet'; views: number; visitors: number }>
    sources: Array<{ type: 'direct' | 'google' | 'social' | 'other'; visits: number }>
    assistant: { today: AssistantRange; d7: AssistantRange; d30: AssistantRange }
}
interface Dashboard {
    totalOrders?: number
    totalRevenue?: number
    pendingOrders?: number
    completedOrders?: number
    cancelledOrders?: number
    avgOrderValue?: number
    totalUsers?: number
    topProducts?: Array<{ name: string; sold_count: number }>
    categoryStats?: Array<{ category: string | null; total_sales: number | null }>
}

const nf = new Intl.NumberFormat('tr-TR')
const money = (n: number) => `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(n)} ₺`
const shortDate = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', timeZone: 'UTC' })

const DEVICE_LABELS = { phone: 'Telefon', desktop: 'Bilgisayar', tablet: 'Tablet' } as const
const DEVICE_ICONS = { phone: Smartphone, desktop: Monitor, tablet: Tablet } as const
const SOURCE_LABELS = { direct: 'Doğrudan (adres yazarak, yer imi)', google: 'Google', social: 'Sosyal medya', other: 'Diğer siteler' } as const
const PAGE_NAMES: Record<string, string> = {
    '/': 'Ana sayfa',
    '/products/': 'Tüm ürünler',
    '/odeme/': 'Ödeme',
    '/login/': 'Giriş',
    '/register/': 'Kayıt',
    '/profile/': 'Hesabım',
    '/orders/': 'Siparişlerim',
}

function Card({ title, icon: Icon, children, right }: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode; right?: React.ReactNode }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <Icon className="w-5 h-5 text-slate-500" />
                    {title}
                </h3>
                {right}
            </div>
            {children}
        </div>
    )
}

function Bar({ value, max, className = 'bg-blue-500' }: { value: number; max: number; className?: string }) {
    const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
    return (
        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full ${className}`} style={{ width: `${value > 0 ? pct : 0}%` }} />
        </div>
    )
}

function Empty({ children = 'Henüz veri yok' }: { children?: React.ReactNode }) {
    return <p className="text-slate-500 text-sm">{children}</p>
}

/** Bars = page views, the darker part = distinct visitors (inline SVG, no chart library). */
function DailyChart({ daily }: { daily: DayCount[] }) {
    const [hover, setHover] = React.useState<number | null>(null)
    if (!daily.length) return <Empty />
    const W = 720
    const H = 200
    const pad = { top: 12, bottom: 24, left: 4, right: 4 }
    const max = Math.max(1, ...daily.map(d => d.views))
    const step = (W - pad.left - pad.right) / daily.length
    const bw = Math.max(4, step * 0.7)
    const y = (v: number) => pad.top + (H - pad.top - pad.bottom) * (1 - v / max)
    const active = hover != null ? daily[hover] : daily[daily.length - 1]
    return (
        <div>
            <p className="text-sm text-slate-600 mb-2 min-h-5">
                <span className="font-semibold text-slate-900">{shortDate(active.day)}</span>
                {': '}
                {nf.format(active.views)} görüntüleme
                {active.visitors != null && <> · {nf.format(active.visitors)} farklı ziyaretçi</>}
            </p>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-48" role="img" aria-label="Son 30 günün günlük görüntülenme grafiği" onMouseLeave={() => setHover(null)}>
                <line x1={pad.left} x2={W - pad.right} y1={H - pad.bottom} y2={H - pad.bottom} stroke="#e2e8f0" />
                {daily.map((d, i) => {
                    const x = pad.left + i * step + (step - bw) / 2
                    const isActive = hover === i
                    return (
                        <g key={d.day} onMouseEnter={() => setHover(i)} onClick={() => setHover(i)}>
                            <rect x={pad.left + i * step} y={pad.top} width={step} height={H - pad.top - pad.bottom} fill="transparent" />
                            <rect x={x} y={y(d.views)} width={bw} height={H - pad.bottom - y(d.views)} rx={2} fill={isActive ? '#93c5fd' : '#bfdbfe'} />
                            {d.visitors != null && d.visitors > 0 && (
                                <rect x={x} y={y(d.visitors)} width={bw} height={H - pad.bottom - y(d.visitors)} rx={2} fill={isActive ? '#1d4ed8' : '#3b82f6'} />
                            )}
                            {(i % 5 === 0 || i === daily.length - 1) && (
                                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#94a3b8">{shortDate(d.day)}</text>
                            )}
                        </g>
                    )
                })}
            </svg>
            <div className="flex flex-wrap gap-4 text-xs text-slate-500 mt-2">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200" /> Sayfa görüntüleme</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-500" /> Farklı ziyaretçi</span>
            </div>
        </div>
    )
}

export default function AdminAnalyticsPage() {
    const [days, setDays] = React.useState<7 | 30>(30)
    const [stats, setStats] = React.useState<Stats | null>(null)
    const [error, setError] = React.useState(false)
    const [loading, setLoading] = React.useState(true)
    const [dash, setDash] = React.useState<Dashboard>({})

    React.useEffect(() => {
        fetch('/api/admin/dashboard-stats', { cache: 'no-store' }).then(r => r.json()).then(setDash).catch(() => {})
    }, [])

    React.useEffect(() => {
        let alive = true
        setLoading(true)
        fetch(`/api/analytics/stats/?days=${days}`, { cache: 'no-store' })
            .then(r => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((s: Stats) => { if (alive) { setStats(s); setError(false) } })
            .catch(() => { if (alive) setError(true) })
            .finally(() => { if (alive) setLoading(false) })
        return () => { alive = false }
    }, [days])

    if (loading && !stats) return <div className="text-center py-8">Yükleniyor...</div>
    if (error && !stats) return <div className="text-center py-8 text-red-600">İstatistikler yüklenemedi. Sayfayı yenileyip tekrar dene.</div>
    if (!stats) return null

    const d30 = stats.ranges.find(r => r.key === 'd30')
    const conversion = d30 && d30.visitors ? (d30.orders / d30.visitors) * 100 : null
    const maxProduct = Math.max(1, ...stats.topProducts.map(p => p.views))
    const maxPage = Math.max(1, ...stats.topPages.map(p => p.views))
    const deviceTotal = stats.devices.reduce((n, d) => n + d.visitors, 0)
    const sourceTotal = stats.sources.reduce((n, s) => n + s.visits, 0)
    const sinceText = stats.since ? shortDate(stats.since) : null

    const daysToggle = (
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {([7, 30] as const).map(d => (
                <button
                    key={d}
                    type="button"
                    onClick={() => setDays(d)}
                    className={`px-3 py-1 rounded-md text-xs font-medium ${days === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                    Son {d} gün
                </button>
            ))}
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap justify-between items-end gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">İstatistikler</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Ziyaretçiler çerezsiz ve kimliksiz sayılır; bot trafiği sayılmaz. Günler Türkiye saatine göredir.
                    </p>
                </div>
                {daysToggle}
            </div>

            {/* Visits per range */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
                {stats.ranges.map(r => (
                    <div key={r.key} className={`p-4 rounded-xl border ${r.key === 'today' ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200'}`}>
                        <p className={`text-xs font-medium ${r.key === 'today' ? 'text-white/70' : 'text-slate-500'}`}>{r.label}</p>
                        <p className="text-2xl font-bold mt-1">
                            {r.visitors == null ? '—' : nf.format(r.visitors)}
                            {r.approx && <span className={`ml-1 text-xs font-medium ${r.key === 'today' ? 'text-white/70' : 'text-slate-500'}`}>yaklaşık</span>}
                        </p>
                        <p className={`text-xs ${r.key === 'today' ? 'text-white/70' : 'text-slate-500'}`}>
                            farklı ziyaretçi{r.partial && sinceText ? ` (sayım başlangıcı: ${sinceText})` : ''}
                        </p>
                        <p className={`text-sm mt-2 ${r.key === 'today' ? 'text-white' : 'text-slate-700'}`}>
                            <span className="font-semibold">{nf.format(r.views)}</span> sayfa görüntüleme
                        </p>
                        <p className={`text-sm ${r.key === 'today' ? 'text-white' : 'text-slate-700'}`}>
                            <span className="font-semibold">{nf.format(r.orders)}</span> sipariş · {money(r.revenue)}
                        </p>
                    </div>
                ))}
            </div>
            {!stats.since && (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Farklı ziyaretçi sayımı yeni başladı; ilk ziyaretlerden sonra burada görünecek. Eski günler için yalnızca sayfa görüntüleme sayısı var.
                </p>
            )}

            <Card title="Son 30 gün" icon={Calendar}>
                <DailyChart daily={stats.daily} />
            </Card>

            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="En çok incelenen ürünler" icon={Package} right={<span className="text-xs text-slate-500">Son {stats.days} gün</span>}>
                    {stats.topProducts.length ? (
                        <ol className="space-y-3">
                            {stats.topProducts.map((p, i) => (
                                <li key={p.id} className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="w-5 text-slate-400 font-semibold">{i + 1}</span>
                                        {p.slug && p.active ? (
                                            <a href={`/${p.slug}/`} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-slate-700 hover:text-blue-600" title={p.name}>
                                                {p.name}
                                                <ExternalLink className="inline w-3 h-3 ml-1 align-baseline text-slate-400" />
                                            </a>
                                        ) : (
                                            <span className="flex-1 min-w-0 truncate text-slate-500" title={p.name}>{p.name}{!p.active && ' (yayında değil)'}</span>
                                        )}
                                        <span className="font-bold text-slate-900">{nf.format(p.views)}</span>
                                    </div>
                                    <div className="pl-7"><Bar value={p.views} max={maxProduct} className="bg-purple-500" /></div>
                                </li>
                            ))}
                        </ol>
                    ) : <Empty />}
                </Card>

                <Card title="En çok ziyaret edilen sayfalar" icon={TrendingUp} right={<span className="text-xs text-slate-500">Son {stats.days} gün</span>}>
                    {stats.topPages.length ? (
                        <ol className="space-y-3">
                            {stats.topPages.map(p => (
                                <li key={p.path} className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="flex-1 min-w-0 truncate text-slate-700" title={p.path}>{PAGE_NAMES[p.path] ?? p.path}</span>
                                        <span className="font-bold text-slate-900">{nf.format(p.views)}</span>
                                    </div>
                                    <Bar value={p.views} max={maxPage} className="bg-green-500" />
                                </li>
                            ))}
                        </ol>
                    ) : <Empty />}
                </Card>

                <Card title="Cihazlar" icon={Smartphone} right={<span className="text-xs text-slate-500">Son {stats.days} gün</span>}>
                    {deviceTotal > 0 ? (
                        <ul className="space-y-3">
                            {stats.devices.map(d => {
                                const Icon = DEVICE_ICONS[d.type]
                                const pct = Math.round((d.visitors / deviceTotal) * 100)
                                return (
                                    <li key={d.type} className="space-y-1">
                                        <div className="flex items-center gap-2 text-sm">
                                            <Icon className="w-4 h-4 text-slate-400" />
                                            <span className="flex-1 text-slate-700">{DEVICE_LABELS[d.type]}</span>
                                            <span className="text-slate-500">{nf.format(d.visitors)} kişi</span>
                                            <span className="w-10 text-right font-bold text-slate-900">%{pct}</span>
                                        </div>
                                        <Bar value={d.visitors} max={deviceTotal} />
                                    </li>
                                )
                            })}
                        </ul>
                    ) : <Empty>Cihaz bilgisi yeni sayımla birlikte gelecek.</Empty>}
                </Card>

                <Card title="Ziyaretçiler nereden geliyor" icon={Globe} right={<span className="text-xs text-slate-500">Son {stats.days} gün</span>}>
                    {sourceTotal > 0 ? (
                        <ul className="space-y-3">
                            {stats.sources.map(s => (
                                <li key={s.type} className="space-y-1">
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="flex-1 text-slate-700">{SOURCE_LABELS[s.type]}</span>
                                        <span className="text-slate-500">{nf.format(s.visits)} giriş</span>
                                        <span className="w-10 text-right font-bold text-slate-900">%{Math.round((s.visits / sourceTotal) * 100)}</span>
                                    </div>
                                    <Bar value={s.visits} max={sourceTotal} className="bg-orange-500" />
                                </li>
                            ))}
                        </ul>
                    ) : <Empty>Kaynak bilgisi yeni sayımla birlikte gelecek.</Empty>}
                </Card>
            </div>

            <Card
                title="Onopo Asistan"
                icon={Bot}
                right={<Link href="/admin/assistant/sohbetler/" prefetch={false} className="text-sm font-medium text-blue-600 hover:text-blue-700">Sohbetleri gör →</Link>}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-slate-500">
                                <th className="py-2 pr-4 font-medium" />
                                <th className="py-2 px-3 font-medium text-right">Sohbet</th>
                                <th className="py-2 px-3 font-medium text-right">Mesaj</th>
                                <th className="py-2 px-3 font-medium text-right">WhatsApp&apos;a yönlendirme</th>
                                <th className="py-2 pl-3 font-medium text-right">WhatsApp&apos;a geçen</th>
                            </tr>
                        </thead>
                        <tbody>
                            {([['Bugün', stats.assistant.today], ['Son 7 gün', stats.assistant.d7], ['Son 30 gün', stats.assistant.d30]] as const).map(([label, a]) => (
                                <tr key={label} className="border-t border-slate-100">
                                    <td className="py-2 pr-4 text-slate-700 font-medium">{label}</td>
                                    <td className="py-2 px-3 text-right font-bold text-slate-900">{nf.format(a.conversations)}</td>
                                    <td className="py-2 px-3 text-right text-slate-700">{nf.format(a.turns)}</td>
                                    <td className="py-2 px-3 text-right text-slate-700">{nf.format(a.handoffs)}</td>
                                    <td className="py-2 pl-3 text-right text-slate-700">{nf.format(a.waClicks)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <p className="text-xs text-slate-500 mt-3">Mesaj: ziyaretçilerin asistana yazdığı mesaj sayısı. WhatsApp&apos;a geçen: WhatsApp düğmesine basanlar.</p>
            </Card>

            {/* Sales (all time, from the existing dashboard numbers) */}
            <div>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Satışlar (tüm zamanlar)</h2>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
                    <Small title="Toplam ciro" value={money(dash.totalRevenue || 0)} />
                    <Small title="Toplam sipariş" value={nf.format(dash.totalOrders || 0)} />
                    <Small title="Ortalama sepet" value={money(dash.avgOrderValue || 0)} />
                    <Small title="Bekleyen" value={nf.format(dash.pendingOrders || 0)} />
                    <Small title="İptal edilen" value={nf.format(dash.cancelledOrders || 0)} />
                    <Small
                        title="Dönüşüm (30 gün)"
                        value={conversion == null ? '—' : `%${conversion.toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`}
                        hint="Sipariş ÷ farklı ziyaretçi"
                    />
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                <Card title="En çok satan ürünler" icon={Award}>
                    {dash.topProducts?.length ? (
                        <ol className="space-y-2">
                            {dash.topProducts.slice(0, 10).map((p, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                    <span className="w-5 text-slate-400 font-semibold">{i + 1}</span>
                                    <span className="flex-1 min-w-0 truncate text-slate-700">{p.name}</span>
                                    <span className="font-bold text-slate-900">{nf.format(Number(p.sold_count) || 0)} adet</span>
                                </li>
                            ))}
                        </ol>
                    ) : <Empty>Henüz satış yok</Empty>}
                </Card>
                <Card title="Kategoriye göre satışlar" icon={CreditCard}>
                    {dash.categoryStats?.length ? (
                        <ul className="space-y-2">
                            {dash.categoryStats.slice(0, 10).map((c, i) => (
                                <li key={i} className="flex items-center gap-2 text-sm">
                                    <span className="flex-1 min-w-0 truncate text-slate-700">{c.category || 'Genel'}</span>
                                    <span className="font-bold text-slate-900">{money(Number(c.total_sales) || 0)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : <Empty />}
                </Card>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5" />
                Sipariş sayılarına iptal edilenler ve ödemesi tamamlanmamış kartlı siparişler katılmaz.
            </p>
        </div>
    )
}

function Small({ title, value, hint }: { title: string; value: string; hint?: string }) {
    return (
        <div className="p-4 rounded-xl border bg-white border-slate-200">
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className="text-xl font-bold text-slate-900">{value}</p>
            {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
        </div>
    )
}
