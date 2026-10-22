import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { itemsTotal, lineTotal, parseShippingSettings, shippingCost, ShippingSettings, DEFAULT_SHIPPING_SETTINGS } from '@/lib/pricing'

// Coupons are not applied by the order API (it charges items + shipping only, see lib/pricing.ts)
// and no coupon exists, so the coupon box stays hidden in the cart drawer and checkout until
// coupons are implemented end to end (order API, PayTR basket, BirFatura lines).
export const COUPONS_ENABLED = false

// Line total exactly as the order API charges it (rounded unit price x quantity)
export function cartLineTotal(item: Pick<CartItem, 'price' | 'quantity'>): number {
    return lineTotal(item.price, item.quantity)
}

export interface Product {
    id: number | string
    name: string
    price: number
    image: string
    category?: string
    slug?: string
    free_shipping?: boolean
}

export interface CartItem extends Product {
    quantity: number
}

interface CartState {
    items: CartItem[]
    isOpen: boolean
    coupon: { code: string, discountType: 'fixed' | 'percent', discountValue: number } | null
    shippingSettings: ShippingSettings
    fetchShippingSettings: () => Promise<void>
    addItem: (product: Product) => void
    removeItem: (productId: number | string) => void
    updateQuantity: (productId: number | string, quantity: number) => void
    applyCoupon: (code: string, discountType: 'fixed' | 'percent', discountValue: number) => void
    removeCoupon: () => void
    clearCart: () => void
    toggleCart: () => void
    openCart: () => void
    closeCart: () => void
    totalItems: () => number
    totalPrice: () => number
    getSubtotal: () => number
    getShippingCost: () => number
    getTotal: () => number
}

// The saved cart in localStorage. Its key and shape ({ state: { items, coupon, shippingSettings }, version })
// stay as they are: carts saved by earlier visits and the checkout depend on them.
const CART_STORAGE_KEY = 'onopo-cart-storage'

type SavedCart = Pick<CartState, 'items' | 'coupon' | 'shippingSettings'>

/**
 * The saved cart as it is right now, or null when it cannot be read (no storage, blocked storage, a value
 * that is not a cart): then this page's own copy stays. No saved cart at all is an empty cart (another page
 * may have removed it). The shipping rule falls back to `shipping` when the saved cart has none.
 */
function readSavedCart(shipping: ShippingSettings): SavedCart | null {
    if (typeof window === 'undefined') return null
    try {
        const raw = window.localStorage.getItem(CART_STORAGE_KEY)
        if (raw === null) return { items: [], coupon: null, shippingSettings: shipping }
        const saved = JSON.parse(raw)?.state
        if (!saved || !Array.isArray(saved.items)) return null
        return {
            items: saved.items,
            coupon: saved.coupon ?? null,
            shippingSettings: saved.shippingSettings && typeof saved.shippingSettings === 'object' ? saved.shippingSettings : shipping,
        }
    } catch {
        return null
    }
}

/**
 * What this page's copy of the cart must take over from the saved cart, or null when the two already agree.
 * The whole saved part is taken (lines, coupon, shipping rule), so writing it back saves the same text again:
 * that is no change for the other tabs, so two tabs never bounce updates between each other.
 */
function savedCartChanges(state: CartState): SavedCart | null {
    const saved = readSavedCart(state.shippingSettings)
    if (!saved) return null
    const mine: SavedCart = { items: state.items, coupon: state.coupon, shippingSettings: state.shippingSettings }
    return JSON.stringify(saved) === JSON.stringify(mine) ? null : saved
}

/**
 * Called by every cart write before it changes anything. persist saves the whole cart on every set, even when
 * only the drawer opens, and another tab (or this page before a back/forward cache restore) may have changed
 * the saved cart since this page last read it: a write from that stale copy would drop the other page's lines.
 * So the write first takes over the saved cart, then applies its own change to it.
 */
function pullSavedCart(get: () => CartState, set: (partial: Partial<CartState>) => void) {
    const saved = savedCartChanges(get())
    if (saved) set(saved)
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            coupon: null,
            shippingSettings: { ...DEFAULT_SHIPPING_SETTINGS },

            fetchShippingSettings: async () => {
                try {
                    const res = await fetch('/api/shipping-settings')
                    const data = await res.json()
                    if (data && !data.error) {
                        pullSavedCart(get, set)
                        set({ shippingSettings: parseShippingSettings(data) })
                    }
                } catch (error) {
                    console.error('Failed to fetch shipping settings', error)
                }
            },

            applyCoupon: (code, discountType, discountValue) => {
                pullSavedCart(get, set)
                set({ coupon: { code, discountType, discountValue } })
            },

            removeCoupon: () => {
                pullSavedCart(get, set)
                set({ coupon: null })
            },

            addItem: (product) => {
                pullSavedCart(get, set)
                const items = get().items
                const existingItem = items.find(item => item.id === product.id)
                let newItems

                if (existingItem) {
                    newItems = items.map(item =>
                        item.id === product.id
                            ? { ...item, ...product, quantity: item.quantity + 1 } // Update item properties (like free_shipping)
                            : item
                    )
                } else {
                    newItems = [...items, { ...product, quantity: 1 }]
                }

                set({ items: newItems })
            },

            removeItem: (productId) => {
                pullSavedCart(get, set)
                const newItems = get().items.filter(item => item.id !== productId)
                set({ items: newItems })
            },

            updateQuantity: (productId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(productId)
                    return
                }
                pullSavedCart(get, set)
                set({
                    items: get().items.map(item =>
                        item.id === productId ? { ...item, quantity } : item
                    )
                })
            },

            clearCart: () => {
                pullSavedCart(get, set)
                set({ items: [], coupon: null })
            },
            toggleCart: () => {
                pullSavedCart(get, set)
                set({ isOpen: !get().isOpen })
            },
            openCart: () => {
                pullSavedCart(get, set)
                set({ isOpen: true })
            },
            closeCart: () => {
                pullSavedCart(get, set)
                set({ isOpen: false })
            },

            totalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

            getSubtotal: () => {
                // Same arithmetic as the order API (lib/pricing.ts): rounded unit price x quantity,
                // summed in cart order and never rounded again. "What you see is what you pay"
                return itemsTotal(get().items)
            },

            getShippingCost: () => {
                const items = get().items
                const subtotal = get().getSubtotal()
                if (subtotal === 0) return 0

                // Eğer herhangi bir üründe ücretsiz kargo varsa, tüm sepet ücretsiz
                return shippingCost(subtotal, items.some(item => item.free_shipping), get().shippingSettings)
            },

            // What the order API will charge: items + shipping
            getTotal: () => get().getSubtotal() + get().getShippingCost(),

            totalPrice: () => {
                const subtotal = get().getSubtotal()
                let total = subtotal

                // The server ignores coupons, so a (stale) coupon must not change the shown amount
                const coupon = COUPONS_ENABLED ? get().coupon : null
                if (coupon) {
                    if (coupon.discountType === 'percent') {
                        total = total * (1 - coupon.discountValue / 100)
                    } else {
                        total = Math.max(0, total - coupon.discountValue)
                    }
                }

                return total
            }
        }),
        {
            name: CART_STORAGE_KEY,
            skipHydration: true,
            // Never persist the drawer's open state, or it reopens by itself after a reload
            partialize: (state) => ({ items: state.items, coupon: state.coupon, shippingSettings: state.shippingSettings }),
            // Carts saved before this fix still contain isOpen: ignore it when loading
            merge: (persistedState, currentState) => ({ ...currentState, ...(persistedState as Partial<CartState>), isOpen: false }),
            version: 2, // Increment version to force refresh if needed
            migrate: (persistedState: any, version: number) => {
                return persistedState as CartState
            }
        }
    )
)

/** Take over the saved cart's changes in this page (badge, drawer); the drawer stays open or shut as it is. */
export function syncSavedCart() {
    const saved = savedCartChanges(useCartStore.getState())
    if (saved) useCartStore.setState(saved)
}

/**
 * Keeps this page's cart in line with the saved one after the first load (LayoutProvider): another tab's
 * changes arrive as 'storage' events (key null: storage cleared), and a page restored from the back/forward
 * cache, which gets no events while it is cached, catches up on 'pageshow'. Returns the cleanup.
 */
export function watchSavedCart(): () => void {
    const onStorage = (e: StorageEvent) => {
        if (e.key === CART_STORAGE_KEY || e.key === null) syncSavedCart()
    }
    const onPageShow = (e: PageTransitionEvent) => {
        if (e.persisted) syncSavedCart()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('pageshow', onPageShow)
    return () => {
        window.removeEventListener('storage', onStorage)
        window.removeEventListener('pageshow', onPageShow)
    }
}

// Hook to check if store is hydrated (safe to use on client)
import { useEffect, useState } from 'react'

export function useCartHydration() {
    const [hydrated, setHydrated] = useState(false)

    useEffect(() => {
        // Rehydrate the store on mount
        useCartStore.persist.rehydrate()
        setHydrated(true)
    }, [])

    return hydrated
}

