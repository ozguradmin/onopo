'use client'

import * as React from 'react'

export default function PageContent({ params }: { params: any }) {
    const [page, setPage] = React.useState<{ title: string, content: string } | null>(null)
    const [loading, setLoading] = React.useState(true)

    const slug = (React.use(params) as { slug: string }).slug

    React.useEffect(() => {
        fetch(`/api/pages/${slug}`)
            .then(r => r.json())
            .then(data => {
                if (data && !data.error) {
                    setPage(data)
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [slug])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    if (!page) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Sayfa Bulunamadı</h1>
                    <p className="text-slate-500">Aradığınız sayfa mevcut değil.</p>
                </div>
            </div>
        )
    }

    const renderContent = (content: string) => {
        return content
            .split('\n\n')
            .map((paragraph, i) => {
                if (paragraph.startsWith('# ')) {
                    return <h1 key={i} className="text-4xl font-extrabold text-slate-900 mb-6 pb-4 border-b border-slate-200">{paragraph.slice(2)}</h1>
                }
                if (paragraph.startsWith('## ')) {
                    return <h2 key={i} className="text-2xl font-bold text-slate-800 mb-4 mt-10 flex items-center">{paragraph.slice(3)}</h2>
                }
                if (paragraph.startsWith('### ')) {
                    return <h3 key={i} className="text-xl font-semibold text-slate-800 mb-3 mt-6">{paragraph.slice(4)}</h3>
                }
                // List items support
                if (paragraph.match(/^\d\./)) {
                    const items = paragraph.split('\n')
                    return (
                        <ol key={i} className="list-decimal pl-5 space-y-2 mb-4 text-slate-600">
                            {items.map((item, idx) => (
                                <li key={idx} className="pl-1">{item.replace(/^\d\.\s/, '')}</li>
                            ))}
                        </ol>
                    )
                }
                return <p key={i} className="text-slate-600 mb-4 leading-7 text-lg">{paragraph}</p>
            })
    }

    return (
        <div className="min-h-screen py-12">
            <div className="container mx-auto px-4 max-w-3xl">
                <article className="prose prose-slate max-w-none">
                    {renderContent(page.content)}
                </article>
            </div>
        </div>
    )
}
