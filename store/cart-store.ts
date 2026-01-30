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
}

export const useCartStore = create<CartState>()(
    persist(
        (set, get) => ({
            items: [],
            isOpen: false,

            coupon: null,
            applyCoupon: (code, discountType, discountValue) => set({
                coupon: { code, discountType, discountValue }
            }),
            removeCoupon: () => set({ coupon: null }),

            addItem: (product) => {
                const items = get().items
                const existingItem = items.find(item => item.id === product.id)

                if (existingItem) {
                    set({
                        items: items.map(item =>
                            item.id === product.id
                                ? { ...item, quantity: item.quantity + 1 }
                                : item
                        )
                    })
                } else {
                    set({ items: [...items, { ...product, quantity: 1 }] })
                }

                // Auto open cart on add
                set({ isOpen: true })
            },

            removeItem: (productId) => {
                set({ items: get().items.filter(item => item.id !== productId) })
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

            totalPrice: () => {
                const subtotal = get().items.reduce((total, item) => {
                    return total + (typeof item.price === 'number' ? item.price : 0) * item.quantity
                }, 0)

                const coupon = get().coupon
                if (!coupon) return subtotal

                if (coupon.discountType === 'percent') {
                    return subtotal * (1 - coupon.discountValue / 100)
                } else {
                    return Math.max(0, subtotal - coupon.discountValue)
                }
            }
        }),
        {
            name: 'onopo-cart-storage',
        }
    )
)
