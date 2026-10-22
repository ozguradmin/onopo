/**
 * Where focus may go when an overlay with a focus trap (useFocusTrap in overlay-hooks.ts: the drawers, the
 * search sheet, the assistant's phone sheet) opens or closes. Pure rules over a few DOM methods, so
 * scripts/focus-rules.test.mjs can check them with plain objects.
 *
 * The rules exist because of an iOS Safari report: with the assistant sheet open and a WhatsApp card's message
 * field in the chat, a tap at the search box opened the keyboard for that message ("Gönderilecek mesaj") in
 * iOS's floating input bar. The tap closed the sheet (its backdrop covers the header), and the field that had
 * focus stayed focused inside the now hidden sheet, or the trap's restore sent focus back to an element that was
 * not on screen. Focus must never stay in, or jump into, a layer that is not visible, and it must never be
 * taken from an element the visitor chose outside the layer.
 */

/** The DOM methods the rules read (an Element, or a test double). */
export interface FocusNode {
    isConnected?: boolean
    closest?(selector: string): unknown
    getClientRects?(): { length: number }
}

export interface FocusRoot {
    contains(node: unknown): boolean
}

/** Hidden or inert subtrees: nothing in them can take focus. */
const UNFOCUSABLE_TREE = '[inert],[hidden]'

function isShown(node: FocusNode): boolean {
    if (node.isConnected === false) return false
    if (node.closest?.(UNFOCUSABLE_TREE)) return false
    // display: none (itself or an ancestor) has no boxes
    if (node.getClientRects && node.getClientRects().length === 0) return false
    return true
}

/**
 * When the trap opens (one frame later): move focus into the layer only while it is still where it was when the
 * layer opened (or nowhere). If the visitor has meanwhile focused something outside, it stays there.
 */
export function shouldTakeInitialFocus(root: FocusRoot, current: unknown, previous: unknown, body: unknown): boolean {
    if (current && root.contains(current)) return false
    return current == null || current === body || current === previous
}

/**
 * When the trap closes: the element focus goes back to, or null to leave it alone. Back to the element that had
 * focus before the layer opened, only if
 *   - focus is still in the closing layer (or nowhere): a visitor who already tapped another field keeps it,
 *   - that element is outside the layer, still in the document and on screen (not hidden, not inert).
 */
export function focusRestoreTarget<T extends FocusNode>(root: FocusRoot, previous: T | null | undefined, current: unknown, body: unknown): T | null {
    if (current && current !== body && !root.contains(current)) return null
    if (!previous || previous === body) return null
    if (root.contains(previous)) return null
    return isShown(previous) ? previous : null
}

/** Whether focus left inside a closing layer must be dropped (blurred) before anything else happens. */
export function mustDropFocus(root: FocusRoot, current: unknown, body: unknown): boolean {
    return !!current && current !== body && root.contains(current)
}
