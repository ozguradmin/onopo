'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

export default function ImageOptimizationPage() {
    const [optimizing, setOptimizing] = useState(false)
    const [progress, setProgress] = useState(0)
    const [stats, setStats] = useState({ total: 0, optimized: 0, saved: '0 MB' })
    const [products, setProducts] = useState<any[]>([])

    // Fetch products
    useState(() => {
        if (typeof window !== 'undefined') {
            fetch('/api/products')
                .then(res => res.json())
                .then(data => {
                    if (Array.isArray(data)) {
                        setProducts(data)
                        const totalImgs = data.reduce((acc, p) => acc + (p.images ? (typeof p.images === 'string' ? JSON.parse(p.images).length : p.images.length) : 0), 0)
                        setStats(prev => ({ ...prev, total: totalImgs }))
                    }
                })
                .catch(() => { })
        }
    })

    const handleOptimize = async () => {
        setOptimizing(true)
        setProgress(0)

        let processed = 0
        const totalImages = stats.total || 1

        for (const product of products) {
            try {
                const res = await fetch('/api/admin/optimize-images', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId: product.id })
                })

                if (res.ok) {
                    const data = await res.json()
                    if (data.optimized) processed += data.optimized
                }
            } catch (e) {
                console.error(e)
            }
            const pct = Math.min(100, Math.round((processed / totalImages) * 100))
            setProgress(pct)
        }

        setOptimizing(false)
        setProgress(100)
        toast.success('Optimizasyon tamamlandı.')
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6 text-slate-900">Görsel Optimizasyonu</h1>

            <div className="grid md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Toplam Görsel</p>
                    <p className="text-3xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Optimize Edilen</p>
                    <p className="text-3xl font-bold text-green-600">{stats.optimized}</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 mb-1">Kazanılan Alan</p>
                    <p className="text-3xl font-bold text-blue-600">{stats.saved}</p>
                </div>
            </div>

            <div className="bg-white p-8 rounded-xl border border-slate-200 max-w-2xl">
                <div className="flex items-start gap-6 mb-8">
                    <div className="p-4 bg-blue-50 rounded-2xl shrink-0">
                        <ImageIcon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">Toplu Optimizasyon</h3>
                        <p className="text-slate-600 leading-relaxed">
                            Tüm ürün görsellerini tarayarak sıkıştırır ve WebP formatına dönüştürür.
                            Bu işlem sayfa yükleme hızını artırır ve sunucu alanından tasarruf sağlar.
                        </p>
                        <div className="mt-4 flex gap-2">
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Lossless Compression</span>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">WebP Conversion</span>
                            <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">Resize</span>
                        </div>
                    </div>
                </div>

                {optimizing ? (
                    <div className="space-y-3 bg-slate-50 p-6 rounded-xl border border-slate-100">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-slate-700">Optimize ediliyor...</span>
                            <span className="text-blue-600">{progress}%</span>
                        </div>
                        <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                            <div
                                className="h-full bg-blue-600 transition-all duration-300 ease-out"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-slate-400 text-center">Lütfen pencereyi kapatmayın.</p>
                    </div>
                ) : (
                    <Button
                        onClick={handleOptimize}
                        className="w-full h-12 text-lg bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/10"
                        disabled={stats.optimized === stats.total}
                    >
                        {stats.optimized === stats.total ? (
                            <>
                                <CheckCircle className="w-5 h-5 mr-2" />
                                Tüm Görseller Optimize Edildi
                            </>
                        ) : (
                            'Optimizasyonu Başlat'
                        )}
                    </Button>
                )}
            </div>
        </div>
    )
}
