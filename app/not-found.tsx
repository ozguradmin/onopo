import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Home, SearchX } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { ProductCard } from '@/components/product/ProductCard'
import { SiteSearchForm } from '@/components/status/SiteSearchForm'
import { getCategories, getNewestProducts, getShippingSettings, type Category, type Product } from '@/lib/catalog'
import { formatCount } from '@/lib/format'

// Real 404 page (HTTP 404 via notFound() or an unknown URL). It sends no canonical (buildMetadata is
// not called here). The data-onopo-nocache marker keeps the edge cache from ever storing it, also when
// notFound() runs after streaming started and the status stays 200.

export const metadata: Metadata = {
    title: 'Sayfa bulunamadı',
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
}

const POPULAR_SEARCHES = ['Type-C kablo', 'Şarj aleti', 'iPhone', 'Powerbank', 'Araç şarj', 'Ekran koruyucu']

async function loadSuggestions(): Promise<{ categories: Category[]; products: Product[]; threshold: number | null }> {
    try {
        const [categories, products, shipping] = await Promise.all([
            getCategories({ hideEmpty: true }),
            getNewestProducts(4),
            getShippingSettings(),
        ])
        return { categories: [...categories].sort((a, b) => b.product_count - a.product_count).slice(0, 6), products, threshold: shipping.freeShippingThreshold }
    } catch (err) {
        // The 404 page must render even when D1 is unavailable
        console.error('[not-found] suggestions unavailable:', err)
        return { categories: [], products: [], threshold: null }
    }
}

export default async function NotFound() {
    const { categories, products, threshold } = await loadSuggestions()

    return (
        <div className="bg-canvas">
            <div hidden data-onopo-nocache="" />
            <section className="bg-surface">
                <div className="container-store py-10 text-center lg:py-16">
                    <div className="mx-auto max-w-2xl">
                        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand-600 shadow-card" aria-hidden="true">
                            <SearchX className="h-8 w-8" />
                        </span>
                        <p className="type-micro mt-5 text-brand-600">Hata 404</p>
                        <h1 className="type-h1 mt-2 text-ink">Aradığın sayfayı bulamadık</h1>
                        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-6 text-muted">
                            Bağlantı eskimiş ya da sayfa kaldırılmış olabilir. Aradığın ürünü hemen bulalım:
                        </p>

                        <SiteSearchForm className="mx-auto mt-6 max-w-xl" />

                        <div className="mt-4">
                            <p className="sr-only">Popüler aramalar</p>
                            <ul className="flex flex-wrap justify-center gap-2">
                                {POPULAR_SEARCHES.map(term => (
                                    <li key={term}>
                                        <Link
                                            href={`/products/?q=${encodeURIComponent(term)}`}
                                            prefetch={false}
                                            rel="nofollow"
                                            className="inline-flex min-h-9 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-ink hover:text-ink"
                                        >
                                            {term}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                            <Link href="/" className={buttonClasses({ variant: 'brand', size: '48' })}>
                                <Home className="h-[18px] w-[18px]" aria-hidden="true" /> Ana sayfaya dön
                            </Link>
                            <Link href="/products/" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                                Tüm ürünler <ArrowRight className="h-[18px] w-[18px]" aria-hidden="true" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {categories.length > 0 && (
                <section aria-labelledby="nf-categories" className="container-store pt-10 lg:pt-14">
                    <h2 id="nf-categories" className="type-h2 text-ink">
                        Popüler kategoriler
                    </h2>
                    <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {categories.map(c => (
                            <li key={c.id}>
                                <Link
                                    href={c.href}
                                    className="group flex min-h-16 items-center justify-between gap-3 rounded-card border border-line bg-white px-4 py-3 transition-colors hover:border-ink"
                                >
                                    <span className="min-w-0">
                                        <span className="block truncate text-[15px] font-semibold text-ink">{c.name}</span>
                                        <span className="block text-[13px] text-muted">{formatCount(c.product_count)}</span>
                                    </span>
                                    <ArrowRight className="h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden="true" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {products.length > 0 && (
                <section aria-labelledby="nf-products" className="container-store pb-14 pt-10 lg:pb-20 lg:pt-14">
                    <div className="flex items-end justify-between gap-4">
                        <h2 id="nf-products" className="type-h2 text-ink">
                            Yeni gelenler
                        </h2>
                        <Link href="/products/" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                            Tümünü gör <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                    </div>
                    <ul className="product-grid mt-4">
                        {products.map(p => (
                            <li key={p.id} className="flex">
                                <ProductCard product={p} freeShippingThreshold={threshold} className="w-full" />
                            </li>
                        ))}
                    </ul>
                </section>
            )}
            {products.length === 0 && <div className="pb-14 lg:pb-20" />}
        </div>
    )
}
