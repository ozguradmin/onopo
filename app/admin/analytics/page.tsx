'use client'

import * as React from 'react'
import { TrendingUp, Eye, Package, Calendar } from 'lucide-react'

export default function AdminAnalyticsPage() {
    const [loading, setLoading] = React.useState(true)
    const [range, setRange] = React.useState<'day' | 'week' | 'month'>('week')
    const [data, setData] = React.useState({
        totalViews: 0,
        pageViews: [] as any[],
        productViews: [] as any[],
        dailyViews: [] as any[]
    })

    React.useEffect(() => {
        fetch(`/api/analytics?range=${range}`)
            .then(r => r.json())
            .then(d => {
                setData({
                    totalViews: d.totalViews || 0,
                    pageViews: d.pageViews || [],
                    productViews: d.productViews || [],
                    dailyViews: d.dailyViews || []
                })
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [range])

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-900">İstatistikler</h1>
                <div className="flex gap-2">
                    {(['day', 'week', 'month'] as const).map(r => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${range === r
                                ? 'bg-slate-900 text-white'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                }`}
                        >
                            {r === 'day' ? 'Bugün' : r === 'week' ? 'Bu Hafta' : 'Bu Ay'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Total Views Card */}
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white p-6 rounded-2xl mb-6">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                        <Eye className="w-7 h-7" />
                    </div>
                    <div>
                        <p className="text-blue-100">Toplam Görüntülenme</p>
                        <p className="text-4xl font-bold">{data.totalViews}</p>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Most Viewed Pages */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        En Çok Ziyaret Edilen Sayfalar
                    </h3>
                    <div className="space-y-3">
                        {data.pageViews.length > 0 ? data.pageViews.map((pv: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-600 truncate">{pv.page || '/'}</span>
                                <span className="font-bold text-slate-900">{pv.count}</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">Henüz veri yok</p>
                        )}
                    </div>
                </div>

                {/* Most Viewed Products */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-500" />
                        En Çok Görüntülenen Ürünler
                    </h3>
                    <div className="space-y-3">
                        {data.productViews.length > 0 ? data.productViews.map((pv: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-600 truncate">{pv.name || `Ürün #${pv.product_id}`}</span>
                                <span className="font-bold text-slate-900">{pv.count}</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">Henüz veri yok</p>
                        )}
                    </div>
                </div>

                {/* Daily Chart */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-orange-500" />
                        Günlük Görüntülenme
                    </h3>
                    <div className="h-40 flex items-end gap-1">
                        {data.dailyViews.length > 0 ? data.dailyViews.slice(0, 14).reverse().map((dv: any, i: number) => {
                            const maxCount = Math.max(...data.dailyViews.map((d: any) => d.count), 1)
                            const height = (dv.count / maxCount) * 100
                            return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div
                                        className="w-full bg-blue-500 rounded-t transition-all"
                                        style={{ height: `${Math.max(height, 4)}%` }}
                                        title={`${dv.date}: ${dv.count} görüntülenme`}
                                    />
                                    <span className="text-xs text-slate-400 rotate-45 origin-left">
                                        {new Date(dv.date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>
                            )
                        }) : (
                            <p className="text-slate-500 text-sm w-full text-center py-8">Henüz veri yok</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-amber-800 text-sm">
                    <strong>Not:</strong> İstatistikler site ziyaretlerinden toplanır. Daha detaylı analizler için Cloudflare Analytics kullanılabilir.
                </p>
            </div>
        </div>
    )
}
