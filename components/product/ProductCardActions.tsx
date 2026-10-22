'use client'

/**
 * Client islands used by ProductCard (and reusable on the product page):
 *   <QuickAddButton>  adds to the cart with the unchanged cart-store payload
 *   <FavoriteButton>  toggles a favourite through the existing /api/favorites API
 *   useFavorites()    shared favourites state (one GET /api/favorites per page load, lazily; none for guests)
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Check, Heart, Plus, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatTL } from '@/lib/format'
import { useCartStore } from '@/store/cart-store'
import { useOptionalStoreData } from '@/components/layout/store-data'
import { hasSessionHint } from '@/lib/session-hint'

// ---------------------------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------------------------

/** What a card needs to add a product to the cart. */
export interface CartableProduct {
    id: number | string
    name: string
    slug?: string | null
    /** RAW product price (the cart and the order API round it themselves). */
    price: number
    image?: string | null
    images?: string[] | string | null
    category?: string | null
    free_shipping?: boolean | number | null
    stock?: number | null
}

function firstImage(p: CartableProduct): string {
    if (p.image) return p.image
    if (Array.isArray(p.images)) return p.images[0] || ''
    if (typeof p.images === 'string') {
        try {
            const parsed = JSON.parse(p.images)
            return Array.isArray(parsed) ? parsed[0] || '' : ''
        } catch {
            return ''
        }
    }
    return ''
}

/**
 * The exact payload every add-to-cart in the store sends (store/cart-store.ts Product shape):
 * { id, name, price, image, category, slug, free_shipping }. Keep it in sync with ProductShowcase /
 * ProductClient so existing carts in localStorage ('onopo-cart-storage') stay valid.
 */
export function toCartItem(p: CartableProduct) {
    return {
        id: p.id as number,
        name: p.name,
        price: p.price,
        image: firstImage(p),
        category: p.category ?? undefined,
        slug: p.slug ?? undefined,
        free_shipping: !!p.free_shipping,
    }
}

/** Toast line after adding: "Kargo bedavaya 240,01 ₺ kaldı" / "Kargo bedava". Mirrors cart-store getShippingCost. */
function shippingNote(threshold: number): string {
    const { items, getSubtotal } = useCartStore.getState()
    if (items.some(i => i.free_shipping)) return 'Kargo bedava'
    const remaining = Math.round((threshold - getSubtotal()) * 100) / 100
    return remaining > 0 ? `Kargo bedavaya ${formatTL(remaining)} kaldı` : 'Kargo bedava'
}

export interface QuickAddButtonProps {
    product: CartableProduct
    /** icon: 36px round brand button (mobile, inside the image well) · full: 40px outline button */
    variant?: 'icon' | 'full'
    /** Open the cart drawer after adding (cards: no, per spec; product page: yes). */
    openDrawer?: boolean
    className?: string
}

export function QuickAddButton({ product, variant = 'full', openDrawer = false, className }: QuickAddButtonProps) {
    const addItem = useCartStore(s => s.addItem)
    const openCart = useCartStore(s => s.openCart)
    const store = useOptionalStoreData()
    const [added, setAdded] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

    const soldOut = product.stock != null && product.stock <= 0

    const onClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (soldOut) return
        addItem(toCartItem(product))
        setAdded(true)
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => setAdded(false), 1500)
        if (openDrawer) {
            openCart()
        } else {
            const threshold = store?.shipping.freeShippingThreshold ?? useCartStore.getState().shippingSettings.freeThreshold
            toast.success('Sepete eklendi', {
                description: shippingNote(threshold),
                action: { label: 'Sepete git', onClick: () => openCart() },
            })
        }
    }

    if (variant === 'icon') {
        return (
            <button
                type="button"
                onClick={onClick}
                disabled={soldOut}
                aria-label={soldOut ? `Stokta yok: ${product.name}` : `Sepete ekle: ${product.name}`}
                className={cn(
                    'relative z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-raised transition-colors duration-150 hover:bg-brand-700 disabled:opacity-40',
                    'before:absolute before:-inset-1 before:content-[""]', // 44px touch target
                    className,
                )}
            >
                {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
            </button>
        )
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={soldOut}
            aria-label={soldOut ? `Stokta yok: ${product.name}` : `Sepete ekle: ${product.name}`}
            className={cn(
                'relative z-10 inline-flex h-10 w-full items-center justify-center gap-2 rounded-card border text-sm font-semibold transition-colors duration-150',
                soldOut
                    ? 'cursor-not-allowed border-line bg-surface text-subtle'
                    : added
                        ? 'border-success bg-success text-white'
                        : 'border-ink bg-white text-ink hover:bg-ink hover:text-white',
                className,
            )}
        >
            {soldOut ? (
                'Stokta yok'
            ) : added ? (
                <>
                    <Check className="h-4 w-4" aria-hidden="true" /> Eklendi
                </>
            ) : (
                <>
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" /> Sepete Ekle
                </>
            )}
        </button>
    )
}

// ---------------------------------------------------------------------------------------------
// Favourites
// ---------------------------------------------------------------------------------------------

type FavState = { status: 'idle' | 'loading' | 'ready'; ids: ReadonlySet<number> }

let favState: FavState = { status: 'idle', ids: new Set() }
const SERVER_STATE: FavState = { status: 'idle', ids: new Set() }
const listeners = new Set<() => void>()

function setFavState(next: FavState) {
    favState = next
    listeners.forEach(l => l())
}

function subscribe(listener: () => void) {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/**
 * Load the visitor's favourites once per page load. Without the session hint cookie the visitor is a
 * guest and the answer is always empty: skip the request (a heart click still asks the API, which
 * answers 401 and sends the guest to the login page).
 */
function loadFavorites() {
    if (favState.status !== 'idle') return
    if (!hasSessionHint()) {
        setFavState({ status: 'ready', ids: new Set() })
        return
    }
    favState = { ...favState, status: 'loading' }
    fetch('/api/favorites', { credentials: 'same-origin' })
        .then(r => (r.ok ? r.json() : { favorites: [] }))
        .then((d: { favorites?: { product_id?: number; id?: number }[] }) => {
            const ids = new Set((d.favorites ?? []).map(f => Number(f.product_id ?? f.id)).filter(Number.isFinite))
            setFavState({ status: 'ready', ids })
        })
        .catch(() => setFavState({ status: 'ready', ids: new Set() }))
}

/** Forget the cached favourites (call after login/logout so the next render reloads them). */
export function resetFavorites() {
    setFavState({ status: 'idle', ids: new Set() })
}

export function useFavorites() {
    const state = React.useSyncExternalStore(subscribe, () => favState, () => SERVER_STATE)

    React.useEffect(() => {
        if (favState.status !== 'idle') return
        const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
        if (w.requestIdleCallback) w.requestIdleCallback(loadFavorites, { timeout: 2500 })
        else setTimeout(loadFavorites, 800)
    }, [])

    const isFavorite = React.useCallback((id: number | string) => state.ids.has(Number(id)), [state])

    /** Toggle; resolves to 'unauthenticated' when the visitor must log in first. */
    const toggle = React.useCallback(async (id: number | string): Promise<'on' | 'off' | 'unauthenticated' | 'error'> => {
        const pid = Number(id)
        const before = favState.ids
        const optimistic = new Set(before)
        if (optimistic.has(pid)) optimistic.delete(pid)
        else optimistic.add(pid)
        setFavState({ status: 'ready', ids: optimistic })
        try {
            const res = await fetch('/api/favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: pid }),
            })
            if (res.status === 401) {
                setFavState({ status: 'ready', ids: before })
                return 'unauthenticated'
            }
            const data = (await res.json()) as { favorited?: boolean }
            if (!res.ok || typeof data.favorited !== 'boolean') throw new Error('favorite toggle failed')
            const confirmed = new Set(favState.ids)
            if (data.favorited) confirmed.add(pid)
            else confirmed.delete(pid)
            setFavState({ status: 'ready', ids: confirmed })
            return data.favorited ? 'on' : 'off'
        } catch {
            setFavState({ status: 'ready', ids: before })
            return 'error'
        }
    }, [])

    return { ready: state.status === 'ready', isFavorite, toggle }
}

export interface FavoriteButtonProps {
    productId: number | string
    productName: string
    /** card: 36px white circle on the image · plain: 48px outline square (product page) */
    variant?: 'card' | 'plain'
    className?: string
}

export function FavoriteButton({ productId, productName, variant = 'card', className }: FavoriteButtonProps) {
    const { isFavorite, toggle } = useFavorites()
    const router = useRouter()
    const [busy, setBusy] = React.useState(false)
    const active = isFavorite(productId)

    const onClick = async (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (busy) return
        setBusy(true)
        const result = await toggle(productId)
        setBusy(false)
        if (result === 'unauthenticated') {
            const back = window.location.pathname + window.location.search
            router.push(`/login?redirect=${encodeURIComponent(back)}`)
        } else if (result === 'error') {
            toast.error('Favoriler güncellenemedi, tekrar deneyin.')
        }
    }

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            aria-label={active ? `Favorilerden çıkar: ${productName}` : `Favorilere ekle: ${productName}`}
            className={cn(
                'relative z-10 inline-flex items-center justify-center transition-colors duration-150',
                variant === 'card'
                    ? 'h-9 w-9 rounded-full bg-white/90 text-ink shadow-card hover:text-sale before:absolute before:-inset-1 before:content-[""]'
                    : 'h-12 w-12 rounded-card border border-line-strong bg-white text-ink hover:border-ink',
                active && 'text-sale',
                className,
            )}
        >
            <Heart className={cn('h-5 w-5', active && 'fill-current')} aria-hidden="true" />
        </button>
    )
}
