import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Product {
    id: number | string
    name: string
    price: number
    image: string
    category?: string
    slug?: string
}

export interface CartItem extends Product {
    quantity: number
}

interface CartState {
    items: CartItem[]
    isOpen: boolean
    coupon: { code: string, discountType: 'fixed' | 'percent', discountValue: number } | null
    shippingSettings: { freeThreshold: number, shippingCost: number }
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
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,
            coupon: null,
            shippingSettings: {
                freeThreshold: 500,
                shippingCost: 100
            },

            fetchShippingSettings: async () => {
                try {
                    const res = await fetch('/api/shipping-settings')
                    const data = await res.json()
                    if (data && !data.error) {
                        set({
                            shippingSettings: {
                                freeThreshold: parseFloat(data.free_shipping_threshold),
                                shippingCost: parseFloat(data.shipping_cost)
                            }
                        })
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
                            ? { ...item, quantity: item.quantity + 1 }
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
                return get().items.reduce((total, item) => total + (item.price * item.quantity), 0)
            },

            getShippingCost: () => {
                const subtotal = get().getSubtotal()
                if (subtotal === 0) return 0
                const settings = get().shippingSettings
                return subtotal >= settings.freeThreshold ? 0 : settings.shippingCost
            },

            totalPrice: () => {
                const subtotal = get().getSubtotal()
                let total = subtotal

                const coupon = get().coupon
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

