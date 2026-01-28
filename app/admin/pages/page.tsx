'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Edit, FileText } from 'lucide-react'

export default function AdminPagesPage() {
    const router = useRouter()
    const [pages, setPages] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/pages')
            .then(r => r.json())
            .then(data => {
                setPages(data || [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    if (loading) return <div className="text-center py-8">Yükleniyor...</div>

    const defaultPages = [
        { slug: 'help', title: 'Yardım Merkezi' },
        { slug: 'shipping', title: 'Kargo ve İade' },
        { slug: 'policy', title: 'Gizlilik Politikası' },
        { slug: 'terms', title: 'Kullanım Koşulları' }
    ]

    // Merge default pages with database pages
    const allPages = defaultPages.map(dp => {
        const dbPage = pages.find(p => p.slug === dp.slug)
        return dbPage || dp
    })

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Sayfalar</h1>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                    {allPages.map(page => (
                        <div key={page.slug} className="p-4 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-slate-600" />
                                </div>
                                <div>
                                    <p className="font-medium text-slate-900">{page.title}</p>
                                    <p className="text-sm text-slate-500">/{page.slug}</p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                onClick={() => router.push(`/admin/pages/${page.slug}`)}
                                className="gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                Düzenle
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
