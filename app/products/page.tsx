import { Suspense } from 'react'
import { ProductGrid } from '@/components/products/ProductGrid'
import { ProductFilters } from '@/components/products/ProductFilters'

export default function ProductsPage({ searchParams }: { searchParams: { category?: string; q?: string } }) {
    return (
        <div className="container mx-auto px-4 py-8 mt-20">
            <h1 className="text-3xl font-bold mb-8">
                {searchParams.category || (searchParams.q ? `Sonuçlar: "${searchParams.q}"` : 'Tüm Ürünler')}
            </h1>

            <div className="flex flex-col lg:flex-row gap-8">
                <aside className="w-full lg:w-64 shrink-0">
                    <Suspense fallback={<div>Yükleniyor...</div>}>
                        <ProductFilters searchParams={searchParams} />
                    </Suspense>
                </aside>

                <main className="flex-1">
                    <Suspense fallback={<div>Yükleniyor...</div>}>
                        <ProductGrid category={searchParams.category} query={searchParams.q} />
                    </Suspense>
                </main>
            </div>
        </div>
    )
}
