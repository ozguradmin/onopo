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
                        set({ shippingSettings: parseShippingSettings(data) })
                    }
                } catch (error) {
                    console.error('Failed to fetch shipping settings', error)
                }
            },

            applyCoupon: (code, discountType, discountValue) => set({
                coupon: { code, discountType, discountValue }
            }),

            removeCoupon: () => set({ coupon: null }),

            addItem: (product) => {
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
                const newItems = get().items.filter(item => item.id !== productId)
                set({ items: newItems })
            },

            updateQuantity: (productId, quantity) => {
                if (quantity <= 0) {
                    get().removeItem(productId)
                    return
                }
                set({
                    items: get().items.map(item =>
                        item.id === productId ? { ...item, quantity } : item
                    )
                })
            },

            clearCart: () => set({ items: [], coupon: null }),
            toggleCart: () => set({ isOpen: !get().isOpen }),
            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),

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
            name: 'onopo-cart-storage',
            skipHydration: true,
            version: 2, // Increment version to force refresh if needed
            migrate: (persistedState: any, version: number) => {
                return persistedState as CartState
            }
        }
    )
)

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

