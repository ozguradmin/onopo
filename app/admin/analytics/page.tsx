'use client'

import * as React from 'react'
import { TrendingUp, Eye, Package, Calendar, ShoppingCart, DollarSign, Users, Percent, Award, CreditCard, ArrowUp, ArrowDown } from 'lucide-react'

interface Stats {
    totalViews: number
    pageViews: any[]
    productViews: any[]
    dailyViews: any[]
    totalOrders: number
    totalRevenue: number
    pendingOrders: number
    completedOrders: number
    cancelledOrders: number
    avgOrderValue: number
    topProducts: any[]
    categoryStats: any[]
    recentOrders: any[]
    conversionRate: number
    totalUsers: number
    newUsersThisWeek: number
}

export default function AdminAnalyticsPage() {
    const [loading, setLoading] = React.useState(true)
    const [range, setRange] = React.useState<'day' | 'week' | 'month'>('week')
    const [data, setData] = React.useState<Stats>({
        totalViews: 0,
        pageViews: [],
        productViews: [],
        dailyViews: [],
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        avgOrderValue: 0,
        topProducts: [],
        categoryStats: [],
        recentOrders: [],
        conversionRate: 0,
        totalUsers: 0,
        newUsersThisWeek: 0
    })

    React.useEffect(() => {
        setLoading(true)
        Promise.all([
            fetch(`/api/analytics?range=${range}`).then(r => r.json()).catch(() => ({})),
            fetch('/api/admin/dashboard-stats').then(r => r.json()).catch(() => ({}))
        ]).then(([analytics, dashboard]) => {
            setData({
                totalViews: analytics.totalViews || 0,
                pageViews: analytics.pageViews || [],
                productViews: analytics.productViews || [],
                dailyViews: analytics.dailyViews || [],
                totalOrders: dashboard.totalOrders || 0,
                totalRevenue: dashboard.totalRevenue || 0,
                pendingOrders: dashboard.pendingOrders || 0,
                completedOrders: dashboard.completedOrders || 0,
                cancelledOrders: dashboard.cancelledOrders || 0,
                avgOrderValue: dashboard.avgOrderValue || 0,
                topProducts: dashboard.topProducts || [],
                categoryStats: dashboard.categoryStats || [],
                recentOrders: dashboard.recentOrders || [],
                conversionRate: analytics.totalViews > 0
                    ? (dashboard.totalOrders / analytics.totalViews * 100)
                    : 0,
                totalUsers: dashboard.totalUsers || 0,
                newUsersThisWeek: dashboard.newUsersThisWeek || 0
            })
            setLoading(false)
        })
    }, [range])

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
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

            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Toplam Gelir"
                    value={`${data.totalRevenue.toFixed(0)} ₺`}
                    icon={DollarSign}
                    color="green"
                />
                <StatCard
                    title="Toplam Sipariş"
                    value={data.totalOrders.toString()}
                    icon={ShoppingCart}
                    color="blue"
                />
                <StatCard
                    title="Görüntülenme"
                    value={data.totalViews.toString()}
                    icon={Eye}
                    color="purple"
                />
                <StatCard
                    title="Dönüşüm Oranı"
                    value={`%${data.conversionRate.toFixed(2)}`}
                    icon={Percent}
                    color="orange"
                />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <SmallStatCard title="Ortalama Sepet" value={`${data.avgOrderValue.toFixed(0)} ₺`} />
                <SmallStatCard title="Bekleyen Sipariş" value={data.pendingOrders.toString()} color="yellow" />
                <SmallStatCard title="Tamamlanan" value={data.completedOrders.toString()} color="green" />
                <SmallStatCard title="İptal Edilen" value={data.cancelledOrders.toString()} color="red" />
                <SmallStatCard title="Toplam Kullanıcı" value={data.totalUsers.toString()} />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Most Viewed Pages */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-500" />
                        En Çok Ziyaret Edilen Sayfalar
                    </h3>
                    <div className="space-y-3">
                        {data.pageViews.length > 0 ? data.pageViews.slice(0, 8).map((pv: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-600 truncate flex-1">{pv.page || '/'}</span>
                                <span className="font-bold text-slate-900 ml-4">{pv.count}</span>
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
                        {data.productViews.length > 0 ? data.productViews.slice(0, 8).map((pv: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-600 truncate flex-1">{pv.name || `Ürün #${pv.product_id}`}</span>
                                <span className="font-bold text-slate-900 ml-4">{pv.count}</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">Henüz veri yok</p>
                        )}
                    </div>
                </div>

                {/* Top Selling Products */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-500" />
                        En Çok Satan Ürünler
                    </h3>
                    <div className="space-y-3">
                        {data.topProducts.length > 0 ? data.topProducts.slice(0, 8).map((p: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold">
                                        {i + 1}
                                    </span>
                                    <span className="text-slate-600 truncate">{p.name}</span>
                                </div>
                                <span className="font-bold text-slate-900 ml-4">{p.sold_count} adet</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">Henüz satış yok</p>
                        )}
                    </div>
                </div>

                {/* Category Performance */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-blue-500" />
                        Kategoriye Göre Satışlar
                    </h3>
                    <div className="space-y-3">
                        {data.categoryStats.length > 0 ? data.categoryStats.slice(0, 8).map((c: any, i: number) => (
                            <div key={i} className="flex justify-between items-center">
                                <span className="text-slate-600 truncate flex-1">{c.category || 'Genel'}</span>
                                <span className="font-bold text-slate-900 ml-4">{c.total_sales?.toFixed(0)} ₺</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">Henüz veri yok</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Daily Views Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-orange-500" />
                    Günlük Görüntülenme Grafiği
                </h3>
                <div className="h-48 flex items-end gap-1">
                    {data.dailyViews.length > 0 ? data.dailyViews.slice(0, 14).reverse().map((dv: any, i: number) => {
                        const maxCount = Math.max(...data.dailyViews.map((d: any) => d.count), 1)
                        const height = (dv.count / maxCount) * 100
                        return (
                            <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                <span className="text-xs font-medium text-slate-600">{dv.count}</span>
                                <div
                                    className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all"
                                    style={{ height: `${Math.max(height, 4)}%` }}
                                    title={`${dv.date}: ${dv.count} görüntülenme`}
                                />
                                <span className="text-xs text-slate-400">
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
    )
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: string; icon: any; color: string }) {
    const colors: any = {
        green: 'from-green-500 to-green-600',
        blue: 'from-blue-500 to-blue-600',
        purple: 'from-purple-500 to-purple-600',
        orange: 'from-orange-500 to-orange-600',
    }
    return (
        <div className={`bg-gradient-to-br ${colors[color]} text-white p-5 rounded-2xl`}>
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                    <Icon className="w-6 h-6" />
                </div>
                <div>
                    <p className="text-white/80 text-sm">{title}</p>
                    <p className="text-2xl font-bold">{value}</p>
                </div>
            </div>
        </div>
    )
}

function SmallStatCard({ title, value, color }: { title: string; value: string; color?: string }) {
    const colorClasses: any = {
        yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
        green: 'bg-green-50 border-green-200 text-green-700',
        red: 'bg-red-50 border-red-200 text-red-700',
    }
    return (
        <div className={`p-4 rounded-xl border ${colorClasses[color || ''] || 'bg-white border-slate-200'}`}>
            <p className="text-xs text-slate-500 mb-1">{title}</p>
            <p className={`text-xl font-bold ${color ? '' : 'text-slate-900'}`}>{value}</p>
        </div>
    )
}
