"use client"

/**
 * Product suggestions inside the cart drawer, from the same compact index the instant search uses
 * (GET /api/products/?index=1, loaded once and shared):
 *   - below the free-shipping threshold: "Kargo bedava için tamamla" (items that reach the threshold
 *     with the least extra spend first, then the best deals)
 *   - empty cart: the newest in-stock products
 * Adding uses the unchanged cart payload (toCartItem).
 */
import * as React from "react"
import Link from "next/link"
import { Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { displayPrice, formatTL } from "@/lib/format"
import { displayName } from "@/lib/search"
import { originalImageUrl, productImageUrl } from "@/lib/images"
import { productPath } from "@/lib/seo"
import { FallbackImage } from "@/components/ui/FallbackImage"
import { toCartItem } from "@/components/product/ProductCardActions"
import { useCartStore } from "@/store/cart-store"
import { useSearchIndex, type SearchIndexItem } from "@/components/search/search-index"

const MAX = 6

export function CartSuggestions({ remaining, title }: { remaining?: number; title?: string }) {
    const index = useSearchIndex()
    const load = index.load
    const items = useCartStore(s => s.items)

    React.useEffect(() => {
        load()
    }, [load])

    const picks = React.useMemo(() => {
        if (!index.items) return []
        const inCart = new Set(items.map(i => String(i.id)))
        const pool = index.items.filter(p => p.stock > 0 && !inCart.has(String(p.id)))
        if (remaining == null) return pool.slice(0, MAX)
        const price = (p: SearchIndexItem) => displayPrice(p.price)
        const saving = (p: SearchIndexItem) => {
            const old = p.original_price ? displayPrice(p.original_price) : 0
            return old > price(p) ? (old - price(p)) / old : 0
        }
        // Products that alone reach the threshold with the least extra spend, then the best deals
        const reach = pool.filter(p => price(p) >= remaining && price(p) <= remaining + 150).sort((a, b) => price(a) - price(b))
        const deals = pool.filter(p => price(p) < remaining).sort((a, b) => saving(b) - saving(a) || price(a) - price(b))
        const list = [...reach.slice(0, 3), ...deals]
        if (list.length < MAX) list.push(...pool.filter(p => !list.includes(p)).sort((a, b) => price(a) - price(b)))
        return list.slice(0, MAX)
    }, [index.items, items, remaining])

    if (index.status === 'error') return null
    if (index.status === 'ready' && picks.length === 0) return null

    const heading = title ?? 'Kargo bedava için tamamla'
    return (
        <section aria-labelledby="cart-suggestions-title" className="border-t border-line py-4">
            <div className="flex items-baseline justify-between px-5">
                <h3 id="cart-suggestions-title" className="text-sm font-bold text-ink">
                    {heading}
                </h3>
                {remaining != null && <span className="text-xs text-muted tabular-nums">{formatTL(remaining)} kaldı</span>}
            </div>
            <ul className="no-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-1">
                {picks.length === 0
                    ? [0, 1, 2].map(k => (
                        <li key={k} aria-hidden="true" className="w-[136px] shrink-0">
                            <div className="skeleton aspect-square w-full rounded-card" />
                            <div className="skeleton mt-2 h-3 w-full rounded-chip" />
                            <div className="skeleton mt-1.5 h-3 w-16 rounded-chip" />
                        </li>
                    ))
                    : picks.map(p => <MiniCard key={p.id} product={p} reaches={remaining != null && displayPrice(p.price) >= remaining} />)}
            </ul>
        </section>
    )
}

function MiniCard({ product, reaches }: { product: SearchIndexItem; reaches: boolean }) {
    const addItem = useCartStore(s => s.addItem)
    const [added, setAdded] = React.useState(false)
    const href = productPath(product.slug)
    const price = displayPrice(product.price)
    const old = product.original_price ? displayPrice(product.original_price) : 0
    const closeCart = useCartStore(s => s.closeCart)

    return (
        <li className="relative w-[136px] shrink-0 snap-start">
            <Link href={href} prefetch={false} onClick={closeCart} className="group block" title={product.name}>
                <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-card border border-line bg-white p-2.5">
                    <FallbackImage
                        src={productImageUrl(product.image, 200)}
                        fallbackSrc={originalImageUrl(product.image)}
                        alt={product.name}
                        width={116}
                        height={116}
                        loading="lazy"
                        className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                </span>
                <span className="mt-2 line-clamp-2 min-h-8 text-xs font-medium leading-4 text-ink-2 group-hover:text-ink">{displayName(product.name)}</span>
                <span className="mt-1 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
                    <span className="text-[13px] font-bold text-ink">{formatTL(price)}</span>
                    {old > price && <del className="text-[11px] text-muted">{formatTL(old)}</del>}
                </span>
                {reaches && <span className="mt-0.5 block text-[11px] font-semibold text-success">Bununla kargo bedava</span>}
            </Link>
            <button
                type="button"
                onClick={() => {
                    addItem(toCartItem(product))
                    setAdded(true)
                    setTimeout(() => setAdded(false), 1500)
                }}
                aria-label={`Sepete ekle: ${product.name}`}
                className={cn(
                    'absolute right-1.5 top-[96px] inline-flex h-9 w-9 items-center justify-center rounded-full text-white shadow-raised transition-colors before:absolute before:-inset-1 before:content-[""]',
                    added ? 'bg-success' : 'bg-brand-600 hover:bg-brand-700',
                )}
            >
                {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
            </button>
        </li>
    )
}
