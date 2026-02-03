"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import ProductClient from "./ProductClient"

// Loading skeleton
function ProductSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 pt-32 animate-pulse">
            <div className="container mx-auto px-4">
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Image skeleton */}
                    <div className="aspect-square bg-slate-200 rounded-2xl" />
                    {/* Info skeleton */}
                    <div className="space-y-4">
                        <div className="h-8 bg-slate-200 rounded w-3/4" />
                        <div className="h-6 bg-slate-200 rounded w-1/2" />
                        <div className="h-10 bg-slate-200 rounded w-1/3" />
                        <div className="h-32 bg-slate-100 rounded" />
                        <div className="h-12 bg-slate-300 rounded-full w-full" />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function Page() {
    const params = useParams()
    const id = params?.id as string

    const [freeShippingThreshold, setFreeShippingThreshold] = useState(500)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!id) return

        // Fetch shipping settings
        fetch('/api/shipping-settings')
            .then(r => r.json())
            .then(settings => {
                if (settings.free_shipping_threshold) {
                    setFreeShippingThreshold(parseFloat(settings.free_shipping_threshold))
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [id])

    if (!id) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 pt-32">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">Ürün Bulunamadı</h1>
                    <a href="/" className="px-6 py-3 bg-primary text-white rounded-full">Ana Sayfaya Dön</a>
                </div>
            </div>
        )
    }

    if (loading) {
        return <ProductSkeleton />
    }

    return <ProductClient id={id} freeShippingThreshold={freeShippingThreshold} />
}
