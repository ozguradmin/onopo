/**
 * Onopo Asistan: the visitor's cart as the chat sees and changes it (contract v2: `cart`, `cart_ops`). Pure and
 * isomorphic, so node --test checks it; cart-actions.ts runs the steps on the real cart store.
 *
 * Why steps instead of a new item list: the cart store re-reads the saved cart before every write (another tab
 * may have changed it), so the chat changes it only through the store's own actions (remove a line, set a
 * line's quantity, add a product) and never replaces the whole list from a copy that may be stale.
 *
 * Rules for `cart_ops` (the assistant changed the cart because the visitor asked):
 * - qty 0 removes every line of that product (a product with options can have several lines);
 * - another qty sets the FIRST line of that product to it (1..99);
 * - a product that is not in the cart is added only when qty > 0 and it was shown in this conversation,
 *   in stock and without options (the caller's `addable` decides), like "Sepete Ekle" would;
 * - everything else is ignored. The lines as they were before are kept, so "Geri al" can put them back.
 */
import type { CartOp } from '@/lib/assistant/contract'

export interface LineLike {
    id: number | string
    quantity: number
}

/** Product id of a cart line: the leading digits of its id ('12-kirmizi' → 12); 0 when there are none. */
export function productIdOf(itemId: number | string): number {
    const n = parseInt(String(itemId), 10)
    return Number.isFinite(n) && n > 0 ? n : 0
}

export function linesOf<T extends LineLike>(items: readonly T[], productId: number): T[] {
    return items.filter(i => productIdOf(i.id) === productId)
}

/** Pieces of a product in the cart, over all of its lines. */
export function inCartQty(items: readonly LineLike[], productId: number): number {
    let n = 0
    for (const i of items) if (productIdOf(i.id) === productId) n += Math.max(0, Number(i.quantity) || 0)
    return n
}

export const MAX_LINE_QTY = 99

export type CartStep<T extends LineLike> =
    | { do: 'remove'; itemId: number | string }
    | { do: 'qty'; itemId: number | string; qty: number }
    | { do: 'add'; item: Omit<T, 'quantity'>; qty: number }

export interface CartOpsPlan<T extends LineLike> {
    steps: CartStep<T>[]
    /** product ids that change */
    touched: number[]
    /** the lines of the touched products as they were (for "Geri al") */
    before: T[]
}

/** The steps that carry out `ops` on `items`. Duplicate ops for one product: the last one counts. */
export function planCartOps<T extends LineLike>(
    items: readonly T[],
    ops: readonly CartOp[],
    addable: (productId: number) => Omit<T, 'quantity'> | null,
): CartOpsPlan<T> {
    const wanted = new Map<number, number>()
    for (const op of Array.isArray(ops) ? ops : []) {
        const id = Number(op?.id)
        const qty = Number(op?.qty)
        if (!Number.isInteger(id) || id <= 0 || !Number.isFinite(qty) || qty < 0) continue
        wanted.set(id, Math.min(MAX_LINE_QTY, Math.round(qty)))
    }
    const plan: CartOpsPlan<T> = { steps: [], touched: [], before: [] }
    for (const [id, qty] of wanted) {
        const lines = linesOf(items, id)
        if (lines.length > 0) {
            if (qty === 0) {
                for (const l of lines) plan.steps.push({ do: 'remove', itemId: l.id })
            } else if (Number(lines[0].quantity) !== qty) {
                plan.steps.push({ do: 'qty', itemId: lines[0].id, qty })
            } else {
                continue
            }
            plan.touched.push(id)
            plan.before.push(...lines.map(l => ({ ...l })))
        } else if (qty > 0) {
            const item = addable(id)
            if (!item || productIdOf(item.id) !== id) continue
            plan.steps.push({ do: 'add', item, qty })
            plan.touched.push(id)
        }
    }
    return plan
}

/** "Geri al": take the touched products out again and put their earlier lines back. */
export function planUndo<T extends LineLike>(current: readonly T[], before: readonly T[], touched: readonly number[]): CartStep<T>[] {
    const ids = new Set(touched)
    const steps: CartStep<T>[] = []
    for (const l of current) if (ids.has(productIdOf(l.id))) steps.push({ do: 'remove', itemId: l.id })
    for (const l of before) {
        if (!ids.has(productIdOf(l.id))) continue
        const { quantity, ...item } = l
        const qty = Math.min(MAX_LINE_QTY, Math.max(1, Math.round(Number(quantity) || 1)))
        steps.push({ do: 'add', item: item as Omit<T, 'quantity'>, qty })
    }
    return steps
}

/**
 * What the steps do to a list, the same way the cart store's actions do (removeItem, updateQuantity with
 * 0 = remove, addItem then updateQuantity). The runner uses the store; this is the model the tests check.
 */
export function applyCartSteps<T extends LineLike>(items: readonly T[], steps: readonly CartStep<T>[]): T[] {
    let out = items.slice()
    for (const s of steps) {
        if (s.do === 'remove') out = out.filter(i => i.id !== s.itemId)
        else if (s.do === 'qty') out = s.qty <= 0 ? out.filter(i => i.id !== s.itemId) : out.map(i => (i.id === s.itemId ? { ...i, quantity: s.qty } : i))
        else {
            const existing = out.some(i => i.id === s.item.id)
            out = existing
                ? out.map(i => (i.id === s.item.id ? ({ ...i, ...s.item, quantity: s.qty } as T) : i))
                : [...out, { ...s.item, quantity: s.qty } as T]
        }
    }
    return out
}

/** Free-shipping state of a cart: the same rule as the cart store (a free-shipping line, or the threshold). */
export function freeShippingState(total: number, threshold: number, hasFreeLine: boolean): { free: boolean; left: number; progress: number } {
    const free = hasFreeLine || (threshold > 0 && total >= threshold)
    const left = free || threshold <= 0 ? 0 : Math.max(0, Math.round((threshold - total) * 100) / 100)
    const progress = free || threshold <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((total / threshold) * 100)))
    return { free, left, progress }
}
