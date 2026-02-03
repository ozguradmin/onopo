import { Metadata } from "next"
import { Suspense } from "react"
import ProductsPageClient from "./ProductsPageClient"

// Static metadata for SEO
export const metadata: Metadata = {
    title: 'Tüm Ürünler - ONOPO Store',
    description: 'ONOPO Store\'da teknoloji, gaming ve kozmetik ürünlerini keşfedin. En uygun fiyatlarla kaliteli ürünler.',
    openGraph: {
        title: 'Tüm Ürünler - ONOPO Store',
        description: 'ONOPO Store\'da teknoloji, gaming ve kozmetik ürünlerini keşfedin.',
        type: 'website',
    },
}

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

// Server Component with Suspense for client component
export default function ProductsPage() {
    return (
        <Suspense fallback={<ProductsSkeleton />}>
            <ProductsPageClient />
        </Suspense>
    )
}
