/**
 * Empties the saved cart on PayTR's success page (/siparis-basarili/ only, never /siparis-hata/).
 *
 * The page opens inside the payment iframe on /odeme/ (same origin). /odeme/ empties the cart itself
 * once its status poll sees the order paid, but the customer can leave first through this page's
 * links (target="_top"), and those plain links work before hydration. So this is an inline script that
 * runs while the HTML is parsed, before any link exists: it does what the cart store's clearCart()
 * does (items [] and coupon null) to the store's persisted value (key 'onopo-cart-storage', zustand
 * persist format { state, version }, store/cart-store.ts), keeping the shipping settings and version.
 * The write also fires a 'storage' event, so other open tabs (and /odeme/ around the iframe) can pick
 * the change up. Static content: no order, session or cart data in the HTML.
 */
const CLEAR_SAVED_CART = `try{var k='onopo-cart-storage',v=localStorage.getItem(k),d=v&&JSON.parse(v);if(d&&d.state&&Array.isArray(d.state.items)&&(d.state.items.length||d.state.coupon)){d.state.items=[];d.state.coupon=null;localStorage.setItem(k,JSON.stringify(d))}}catch(e){}`

export function ClearCartOnSuccess() {
    return <script dangerouslySetInnerHTML={{ __html: CLEAR_SAVED_CART }} />
}
