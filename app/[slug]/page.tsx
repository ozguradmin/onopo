"use client"

import { useEffect, useState } from "react"
import { useParams, notFound } from "next/navigation"
import CategoryClient from "./CategoryClient"
import ProductClient from "../product/[id]/ProductClient"

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

// Loading skeleton
function PageSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 pt-32 animate-pulse">
            <div className="container mx-auto px-4">
                <div className="h-10 bg-slate-200 rounded w-64 mb-8" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function Page() {
    const params = useParams()
    const slug = params?.slug as string

    const [pageType, setPageType] = useState<'category' | 'product' | 'notfound' | 'loading'>('loading')
    const [productId, setProductId] = useState<string | null>(null)
    const [freeShippingThreshold, setFreeShippingThreshold] = useState(500)

    useEffect(() => {
        if (!slug) {
            setPageType('notfound')
            return
        }

        // Check if it's a valid category first (no API call needed)
        if (VALID_CATEGORIES.includes(slug)) {
            setPageType('category')
            return
        }

        // Otherwise, check if it's a product slug
        fetch(`/api/products?slug=${encodeURIComponent(slug)}&exact=true`)
            .then(r => r.json())
            .then(data => {
                if (data && data.id) {
                    setProductId(String(data.id))
                    // Fetch shipping settings
                    fetch('/api/shipping-settings')
                        .then(r => r.json())
                        .then(settings => {
                            if (settings.free_shipping_threshold) {
                                setFreeShippingThreshold(parseFloat(settings.free_shipping_threshold))
                            }
                            setPageType('product')
                        })
                        .catch(() => setPageType('product'))
                } else {
                    // Try fuzzy match / redirect
                    fetch(`/api/products?search_slug=${encodeURIComponent(slug)}`)
                        .then(r => r.json())
                        .then(fuzzyData => {
                            if (fuzzyData && fuzzyData.slug && fuzzyData.slug !== slug) {
                                // Redirect to correct slug
                                window.location.href = `/${fuzzyData.slug}`
                            } else {
                                setPageType('notfound')
                            }
                        })
                        .catch(() => setPageType('notfound'))
                }
            })
            .catch(() => setPageType('notfound'))
    }, [slug])

    if (pageType === 'loading') {
        return <PageSkeleton />
    }

    if (pageType === 'notfound') {
        // Client-side 404
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 pt-32">
                <div className="text-center">
                    <h1 className="text-6xl font-bold text-slate-900 mb-4">404</h1>
                    <p className="text-xl text-slate-600 mb-8">Sayfa bulunamadı</p>
                    <a href="/" className="px-6 py-3 bg-primary text-white rounded-full hover:bg-primary/90 transition">
                        Ana Sayfaya Dön
                    </a>
                </div>
            </div>
        )
    }

    if (pageType === 'category') {
        return <CategoryClient slug={slug} />
    }

    if (pageType === 'product' && productId) {
        return <ProductClient id={productId} freeShippingThreshold={freeShippingThreshold} />
    }

    return <PageSkeleton />
}
