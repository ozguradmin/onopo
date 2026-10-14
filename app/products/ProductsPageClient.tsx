"use client"

import { useState, useEffect, useCallback } from 'react'
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

export default function ProductsPageClient() {
    const searchParams = useSearchParams()
    const [products, setProducts] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [brands, setBrands] = useState<string[]>([])
    const [totalCount, setTotalCount] = useState(0)
    const [totalPages, setTotalPages] = useState(1)
    const [itemsPerPage, setItemsPerPage] = useState(24)
    const [loading, setLoading] = useState(true)
    const [initialLoad, setInitialLoad] = useState(true)

    const category = searchParams.get('category') || undefined
    const query = searchParams.get('q') || undefined
    const page = parseInt(searchParams.get('page') || '1', 10)

    // Fetch products for current page
    const fetchProducts = useCallback(async () => {
        try {
            // Build API URL with search params
            const params = new URLSearchParams()
            if (category) params.set('category', category)
            if (query) params.set('q', query)
            params.set('page', String(page))
            params.set('limit', String(itemsPerPage))

            const response = await fetch(`/api/products?${params.toString()}`)
            const data = await response.json()

            // Handle new paginated response format
            if (data.products) {
                setProducts(data.products)
                setTotalCount(data.totalCount || 0)
                setTotalPages(data.totalPages || 1)
            } else if (Array.isArray(data)) {
                // Fallback for old array format
                setProducts(data)
            }
        } catch (error) {
            console.error('Failed to fetch products:', error)
            setProducts([])
        }
    }, [category, query, page, itemsPerPage])

    // Initial load - fetch categories, settings, and products
    useEffect(() => {
        if (!initialLoad) return

        Promise.all([
            fetch('/api/categories?hideEmpty=true').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json())
        ])
            .then(([categoriesData, settingsData]) => {
                // Map product_count to count for compatibility
                const mappedCategories = (Array.isArray(categoriesData) ? categoriesData : []).map((c: any) => ({
                    ...c,
                    count: c.product_count || 0
                }))
                setCategories(mappedCategories)

                // Get items per page setting
                if (settingsData.products_per_page) {
                    setItemsPerPage(parseInt(settingsData.products_per_page, 10))
                }

                setInitialLoad(false)
            })
            .catch(() => setInitialLoad(false))
    }, [initialLoad])

    // Fetch products when page/category/query changes
    useEffect(() => {
        if (initialLoad) return

        setLoading(true)
        fetchProducts().finally(() => setLoading(false))
    }, [fetchProducts, initialLoad])

    // First load - fetch both metadata and products
    useEffect(() => {
        if (!initialLoad) return

        const loadInitialData = async () => {
            try {
                // Build API URL
                const params = new URLSearchParams()
                if (category) params.set('category', category)
                if (query) params.set('q', query)
                params.set('page', String(page))
                params.set('limit', '24') // Default

                const [productsData, categoriesData, settingsData] = await Promise.all([
                    fetch(`/api/products?${params.toString()}`).then(r => r.json()),
                    fetch('/api/categories?hideEmpty=true').then(r => r.json()),
                    fetch('/api/site-settings').then(r => r.json())
                ])

                // Handle paginated response
                if (productsData.products) {
                    setProducts(productsData.products)
                    setTotalCount(productsData.totalCount || 0)
                    setTotalPages(productsData.totalPages || 1)

                    // Extract brands from this page's products
                    const brandSet = new Set<string>()
                    productsData.products?.forEach((p: any) => {
                        const firstWord = (p.name || '').split(' ')[0]
                        if (firstWord && firstWord.length > 2) {
                            brandSet.add(firstWord)
                        }
                    })
                    setBrands(Array.from(brandSet).slice(0, 20))
                }

                // Map categories
                const mappedCategories = (Array.isArray(categoriesData) ? categoriesData : []).map((c: any) => ({
                    ...c,
                    count: c.product_count || 0
                }))
                setCategories(mappedCategories)

                // Get items per page setting
                const perPage = settingsData.products_per_page ? parseInt(settingsData.products_per_page, 10) : 24
                setItemsPerPage(perPage)

                setInitialLoad(false)
                setLoading(false)
            } catch (error) {
                console.error('Initial load error:', error)
                setInitialLoad(false)
                setLoading(false)
            }
        }

        loadInitialData()
    }, []) // Only run once on mount

    if (loading && initialLoad) {
        return <ProductsSkeleton />
    }

    return (
        <ProductsClient
            initialProducts={products}
            initialCategories={categories}
            initialBrands={brands}
            searchParams={{ category, q: query }}
            itemsPerPage={itemsPerPage}
            serverPagination={{
                totalCount,
                totalPages,
                currentPage: page,
                isLoading: loading
            }}
        />
    )
}
