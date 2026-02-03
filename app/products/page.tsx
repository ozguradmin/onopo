"use client"

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import ProductsClient from '@/components/products/ProductsClient'

// Loading skeleton
function ProductsSkeleton() {
    return (
        <div className="min-h-screen bg-slate-50 pt-32 animate-pulse">
            <div className="container mx-auto px-4">
                <div className="h-10 bg-slate-200 rounded w-64 mb-8" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}

function ProductsPageContent() {
    const searchParams = useSearchParams()
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<string[]>([])
    const [itemsPerPage, setItemsPerPage] = useState(40)
    const [loading, setLoading] = useState(true)

    const category = searchParams.get('category') || undefined
    const query = searchParams.get('q') || undefined

    useEffect(() => {
        // Build API URL with search params
        const params = new URLSearchParams()
        if (category) params.set('category', category)
        if (query) params.set('q', query)
        params.set('limit', '200') // Get more products for client-side filtering

        Promise.all([
            fetch(`/api/products?${params.toString()}`).then(r => r.json()),
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json())
        ])
            .then(([productsData, categoriesData, settingsData]) => {
                setProducts(Array.isArray(productsData) ? productsData : [])
                setCategories(Array.isArray(categoriesData) ? categoriesData : [])

                // Extract brands from products
                const brandSet = new Set<string>()
                productsData?.forEach((p: any) => {
                    const firstWord = (p.name || '').split(' ')[0]
                    if (firstWord && firstWord.length > 2) {
                        brandSet.add(firstWord)
                    }
                })
                setBrands(Array.from(brandSet).slice(0, 20))

                // Get items per page setting
                if (settingsData.products_per_page) {
                    setItemsPerPage(parseInt(settingsData.products_per_page, 10))
                }

                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [category, query])

    if (loading) {
        return <ProductsSkeleton />
    }

    return (
        <ProductsClient
            initialProducts={products}
            initialCategories={categories}
            initialBrands={brands}
            searchParams={{ category, q: query }}
            itemsPerPage={itemsPerPage}
        />
    )
}

export default function ProductsPage() {
    return (
        <Suspense fallback={<ProductsSkeleton />}>
            <ProductsPageContent />
        </Suspense>
    )
}
