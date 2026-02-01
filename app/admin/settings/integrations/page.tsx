'use client'

import { useState, useEffect } from 'react'
import { Copy, ExternalLink, Check, RefreshCw, Globe, ShoppingCart, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function IntegrationsPage() {
    const [copied, setCopied] = useState<string | null>(null)
    const [baseUrl, setBaseUrl] = useState('')
    const [feedStats, setFeedStats] = useState({
        productCount: 0,
        lastUpdated: ''
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        setBaseUrl(window.location.origin)
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            // Use the public products API to get count
            const res = await fetch('/api/products?includeAll=true')
            if (res.ok) {
                const data = await res.json()
                setFeedStats({
                    productCount: Array.isArray(data) ? data.length : 0,
                    lastUpdated: new Date().toLocaleString('tr-TR')
                })
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text)
        setCopied(id)
        setTimeout(() => setCopied(null), 2000)
    }

    const integrations = [
        {
            id: 'google',
            name: 'Google Merchant Center',
            description: 'Google Alışveriş\'te ürünlerinizi listeleyin. Ürün aramalarda ve Google Alışveriş sekmesinde görünün.',
            icon: <Globe className="w-8 h-8 text-blue-600" />,
            feedUrl: `${baseUrl}/api/feeds/google`,
            docUrl: 'https://support.google.com/merchants/answer/7439058',
            color: 'blue',
            steps: [
                'Google Merchant Center hesabı oluşturun',
                'İşletme bilgilerinizi ve web sitenizi doğrulayın',
                'Ürünler > Akışlar menüsüne gidin',
                'Yeni akış ekleyin ve "Planlanmış getirme" seçin',
                'Aşağıdaki Feed URL\'ini yapıştırın'
            ]
        },
        {
            id: 'akakce',
            name: 'Akakçe',
            description: 'Türkiye\'nin en büyük fiyat karşılaştırma sitesinde yer alın. Potansiyel müşterilerinize ulaşın.',
            icon: <ShoppingCart className="w-8 h-8 text-orange-600" />,
            feedUrl: `${baseUrl}/api/feeds/akakce`,
            docUrl: 'https://www.akakce.com/magaza-kayit',
            color: 'orange',
            steps: [
                'Akakçe mağaza başvurusu yapın',
                'Mağaza bilgilerinizi doldurun',
                'Ürün besleme (feed) URL\'i istendiğinde aşağıdaki linki verin',
                'Onay sürecini bekleyin (1-3 iş günü)'
            ]
        },
        {
            id: 'sitemap',
            name: 'SEO - Sitemap',
            description: 'Arama motorlarının sitenizi daha iyi taraması için sitemap ve robots.txt dosyaları.',
            icon: <FileText className="w-8 h-8 text-green-600" />,
            feedUrl: `${baseUrl}/sitemap.xml`,
            extraUrls: [
                { label: 'Robots.txt', url: `${baseUrl}/robots.txt` }
            ],
            docUrl: 'https://search.google.com/search-console',
            color: 'green',
            steps: [
                'Google Search Console\'a giriş yapın',
                'Sitenizi doğrulayın',
                'Sitemap\'ler bölümüne gidin',
                'Aşağıdaki sitemap URL\'ini ekleyin'
            ]
        }
    ]

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Entegrasyonlar</h1>
                    <p className="text-slate-500 mt-1">
                        Ürünlerinizi diğer platformlarla paylaşın ve görünürlüğünüzü artırın
                    </p>
                </div>
                <Button
                    onClick={fetchStats}
                    variant="outline"
                    className="gap-2"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Yenile
                </Button>
            </div>

            {/* Stats Bar */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-4 border border-indigo-100">
                <div className="flex items-center gap-6">
                    <div>
                        <p className="text-sm text-indigo-600 font-medium">Aktif Ürün Sayısı</p>
                        <p className="text-2xl font-bold text-indigo-900">{feedStats.productCount}</p>
                    </div>
                    <div className="h-10 w-px bg-indigo-200" />
                    <div>
                        <p className="text-sm text-indigo-600 font-medium">Son Güncelleme</p>
                        <p className="text-sm font-semibold text-indigo-900">{feedStats.lastUpdated || '-'}</p>
                    </div>
                </div>
            </div>

            {/* Integration Cards */}
            <div className="space-y-6">
                {integrations.map((integration) => (
                    <div
                        key={integration.id}
                        className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                    >
                        <div className={`p-6 border-b border-slate-100 bg-gradient-to-r from-${integration.color}-50/50 to-transparent`}>
                            <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-xl bg-${integration.color}-100/50`}>
                                    {integration.icon}
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-lg font-bold text-slate-900">{integration.name}</h2>
                                    <p className="text-slate-600 mt-1">{integration.description}</p>
                                </div>
                                <a
                                    href={integration.docUrl}
                                    target="_blank"
                                    className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
                                >
                                    Dökümantasyon <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>
                        </div>

                        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Steps */}
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Kurulum Adımları</h3>
                                <ol className="space-y-2">
                                    {integration.steps.map((step, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                                            <span className={`flex-shrink-0 w-5 h-5 rounded-full bg-${integration.color}-100 text-${integration.color}-700 flex items-center justify-center text-xs font-bold`}>
                                                {idx + 1}
                                            </span>
                                            {step}
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Feed URLs */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-slate-700">Feed URL</h3>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        readOnly
                                        value={integration.feedUrl}
                                        className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-700"
                                    />
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => copyToClipboard(integration.feedUrl, integration.id)}
                                        className="gap-1"
                                    >
                                        {copied === integration.id ? (
                                            <><Check className="w-4 h-4 text-green-600" /> Kopyalandı</>
                                        ) : (
                                            <><Copy className="w-4 h-4" /> Kopyala</>
                                        )}
                                    </Button>
                                    <a
                                        href={integration.feedUrl}
                                        target="_blank"
                                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                                        title="Feed'i görüntüle"
                                    >
                                        <ExternalLink className="w-4 h-4 text-slate-500" />
                                    </a>
                                </div>

                                {integration.extraUrls && integration.extraUrls.map((extra, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-slate-500 w-20">{extra.label}:</span>
                                        <input
                                            type="text"
                                            readOnly
                                            value={extra.url}
                                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-700"
                                        />
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyToClipboard(extra.url, `${integration.id}-${idx}`)}
                                            className="gap-1"
                                        >
                                            {copied === `${integration.id}-${idx}` ? (
                                                <Check className="w-4 h-4 text-green-600" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Export Section */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-xl bg-slate-100">
                        <FileText className="w-8 h-8 text-slate-600" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-lg font-bold text-slate-900">Ürün Dışa Aktarma</h2>
                        <p className="text-slate-600 mt-1">
                            Tüm ürünlerinizi CSV veya Excel formatında indirin.
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href="/api/feeds/csv"
                            download="urunler.csv"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            CSV
                        </a>
                        <a
                            href="/api/feeds/xlsx"
                            download="urunler.xlsx"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <FileText className="w-4 h-4" />
                            Excel (XLSX)
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
