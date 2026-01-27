import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Product {
    id: number | string
    name: string
    price: number
    image: string
    category?: string
}

export interface CartItem extends Product {
    quantity: number
}

interface CartState {
    items: CartItem[]
    isOpen: boolean
    addItem: (product: Product) => void
    removeItem: (productId: number | string) => void
    updateQuantity: (productId: number | string, quantity: number) => void
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

            clearCart: () => set({ items: [] }),

            toggleCart: () => set({ isOpen: !get().isOpen }),
            openCart: () => set({ isOpen: true }),
            closeCart: () => set({ isOpen: false }),

            totalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),

            // Helper to parse price string "$29.99" -> 29.99 (assuming simple format for now)
            // Ideally product.price comes as number from API
            totalPrice: () => get().items.reduce((total, item) => {
                // Mock parsing logic if price is string in mock data, but let's assume number or handle it in UI
                return total + (typeof item.price === 'number' ? item.price : 0) * item.quantity
            }, 0)
        }),
        {
            name: 'onopo-cart-storage',
        }
    )
)
