'use client'

/**
 * The chat's hands on the real cart (store/cart-store.ts): every change goes through the store's own actions
 * (addItem, updateQuantity, removeItem), which re-read the saved cart first, so the cart drawer, the header
 * badge, the cart strip and the cart card all update at once. cart-ops.ts decides what to do; this runs it.
 */
import { toCartItem } from '@/components/product/ProductCardActions'
import { useCartStore, type CartItem, type Product } from '@/store/cart-store'
import type { CardProduct } from '@/lib/assistant/contract'
import { linesOf, MAX_LINE_QTY, type CartStep } from './cart-ops'

/** The cart line payload of a chat card, the same one "Sepete Ekle" adds (toCartItem). */
export function cardCartItem(p: CardProduct): Product {
    return toCartItem({
        id: p.id, name: p.name, slug: p.slug, price: p.price, image: p.image ?? undefined,
        category: p.category ?? undefined, free_shipping: p.freeShipping, stock: p.inStock ? 1 : 0,
    })
}

export function runCartSteps(steps: readonly CartStep<CartItem>[]): void {
    const cart = useCartStore.getState()
    for (const s of steps) {
        if (s.do === 'remove') cart.removeItem(s.itemId)
        else if (s.do === 'qty') cart.updateQuantity(s.itemId, s.qty)
        else {
            cart.addItem(s.item)
            if (s.qty !== 1) cart.updateQuantity(s.item.id, s.qty)
        }
    }
}

/** Card stepper: set the product's first cart line to `qty` (0 removes that line). */
export function setFirstLineQty(productId: number, qty: number): void {
    const first = linesOf(useCartStore.getState().items, productId)[0]
    if (!first) return
    useCartStore.getState().updateQuantity(first.id, Math.min(MAX_LINE_QTY, Math.max(0, Math.round(qty))))
}
