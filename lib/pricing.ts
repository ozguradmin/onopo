import { roundPrice } from './roundPrice'

/**
 * Order pricing: the single source of truth for what a customer is charged.
 *
 * app/api/orders/route.ts uses these functions to compute the amount PayTR charges and the
 * order lines BirFatura invoices; the cart drawer and checkout use the same functions so the
 * totals they show are exactly what is charged.
 *
 * Do not change the arithmetic (where rounding happens, the order of the additions, the
 * parseFloat of the shipping settings): server totals must stay byte-identical.
 *   unit price  = roundPrice(base price + variation modifiers)   (rounded per unit, ...,99)
 *   line total  = unit price * quantity                          (never re-rounded)
 *   items total = sum of line totals, in cart order
 *   shipping    = 0 if any item has free shipping or items total >= threshold, else shipping cost
 *   total       = items total + shipping
 */

export interface ShippingSettings {
    freeThreshold: number
    shippingCost: number
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = { freeThreshold: 500.00, shippingCost: 100.00 }

// Unrounded unit price: base product price plus the selected variation modifiers
export function rawUnitPrice(basePrice: number | string, priceModifiers: Array<number | string | null | undefined> = []): number {
    let unitPrice = Number(basePrice)
    for (const modifier of priceModifiers) {
        unitPrice += Number(modifier) || 0
    }
    return unitPrice
}

// What one unit costs the customer (the price shown on product cards, the PDP, JSON-LD and feeds)
export function unitPrice(price: number | string | null | undefined): number {
    return roundPrice(price)
}

// What a cart line costs: rounded unit price times quantity (the sum is never rounded again)
export function lineTotal(price: number | string | null | undefined, quantity: number): number {
    return unitPrice(price) * quantity
}

// Sum of the line totals, accumulated in cart order exactly like the order API does
export function itemsTotal(lines: Array<{ price: number | string | null | undefined, quantity: number }>): number {
    let total = 0
    for (const line of lines) {
        total += lineTotal(line.price, line.quantity)
    }
    return total
}

// Shipping settings as the order API reads them from the shipping_settings row (or the defaults)
export function parseShippingSettings(row: { free_shipping_threshold?: unknown, shipping_cost?: unknown } | null | undefined): ShippingSettings {
    return {
        freeThreshold: row ? parseFloat(row.free_shipping_threshold as string) : DEFAULT_SHIPPING_SETTINGS.freeThreshold,
        shippingCost: row ? parseFloat(row.shipping_cost as string) : DEFAULT_SHIPPING_SETTINGS.shippingCost
    }
}

// Free shipping if any item has free_shipping, or the items total reaches the threshold
export function shippingCost(itemsTotalAmount: number, hasFreeShippingItem: boolean, settings: ShippingSettings): number {
    if (!hasFreeShippingItem && itemsTotalAmount < settings.freeThreshold) {
        return settings.shippingCost
    }
    return 0
}

export function orderTotal(itemsTotalAmount: number, shipping: number): number {
    return itemsTotalAmount + shipping
}

// Whole-cart quote with the same arithmetic as the order API (used for display and feeds)
export function quoteCart(
    lines: Array<{ price: number | string | null | undefined, quantity: number, freeShipping?: boolean }>,
    settings: ShippingSettings
): { itemsTotal: number, shipping: number, total: number } {
    const items = itemsTotal(lines)
    const shipping = shippingCost(items, lines.some(line => !!line.freeShipping), settings)
    return { itemsTotal: items, shipping, total: orderTotal(items, shipping) }
}
