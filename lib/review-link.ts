/**
 * Signed review links: https://onopostore.com/degerlendir/?t=<token>
 *
 * The daily review-request e-mail (lib/order-reviews.ts sendReviewRequests) carries one link per order. The token
 * proves that whoever opens it got that e-mail, so a guest can review the products of that order without an
 * account. Format: `<order id>.<expiry, unix seconds>.<signature>`, where the signature is
 * HMAC-SHA256(key = JWT_SECRET + ":review-link", data = "onopo:review-link:v1|<order id>|<expiry>") in base64url.
 * The purpose label in both the key and the data means no other token signed with JWT_SECRET (auth cookies,
 * password-reset links) can ever be accepted here, and the reverse.
 *
 * Nothing secret or personal is in the token: only the order number and the expiry. Fails closed: without a
 * real secret no token is signed or accepted.
 *
 * Pure (Web Crypto only), so the Worker, the routes and the node tests share it.
 */

export const REVIEW_LINK_PURPOSE = 'onopo:review-link:v1'
/** A link works this long after the e-mail went out. */
export const REVIEW_LINK_TTL_DAYS = 60
export const REVIEW_LINK_PATH = '/degerlendir/'

/** lib/auth.ts falls back to this literal when JWT_SECRET is missing; it is public, so it never signs a link. */
const PUBLIC_FALLBACK_SECRET = 'super-secret-key-change-this'

const TOKEN_RE = /^(\d{1,12})\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/

export type ReviewTokenCheck =
    | { ok: true; orderId: number; expiresAt: Date }
    | { ok: false; reason: 'invalid' | 'expired' | 'no_secret' }

/** Whether this secret may sign and verify review links. */
export function usableReviewSecret(secret: string | null | undefined): secret is string {
    return typeof secret === 'string' && secret.length >= 16 && secret !== PUBLIC_FALLBACK_SECRET
}

function base64url(bytes: ArrayBuffer): string {
    let bin = ''
    for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b)
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(`${secret}:review-link`),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        [usage],
    )
}

function signedData(orderId: number, exp: number): Uint8Array {
    return new TextEncoder().encode(`${REVIEW_LINK_PURPOSE}|${orderId}|${exp}`)
}

/** Token for one order, valid for REVIEW_LINK_TTL_DAYS from `now`. Throws without a usable secret. */
export async function signReviewToken(orderId: number, secret: string | null | undefined, now: Date = new Date(), ttlDays: number = REVIEW_LINK_TTL_DAYS): Promise<string> {
    if (!usableReviewSecret(secret)) throw new Error('review_link_secret_missing')
    if (!Number.isSafeInteger(orderId) || orderId <= 0) throw new Error('review_link_bad_order')
    const exp = Math.floor(now.getTime() / 1000) + Math.round(ttlDays * 24 * 60 * 60)
    const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret, 'sign'), signedData(orderId, exp) as BufferSource)
    return `${orderId}.${exp}.${base64url(sig)}`
}

/**
 * Checks a token from the link. The signature is verified before the expiry is looked at (crypto.subtle.verify
 * compares in constant time), so a forged token only ever gets "invalid".
 */
export async function verifyReviewToken(token: unknown, secret: string | null | undefined, now: Date = new Date()): Promise<ReviewTokenCheck> {
    if (!usableReviewSecret(secret)) return { ok: false, reason: 'no_secret' }
    const m = typeof token === 'string' ? TOKEN_RE.exec(token.trim()) : null
    if (!m) return { ok: false, reason: 'invalid' }
    const orderId = Number(m[1])
    const exp = Number(m[2])
    if (!Number.isSafeInteger(orderId) || orderId <= 0 || !Number.isSafeInteger(exp)) return { ok: false, reason: 'invalid' }
    let valid = false
    try {
        valid = await crypto.subtle.verify('HMAC', await hmacKey(secret, 'verify'), fromBase64url(m[3]) as BufferSource, signedData(orderId, exp) as BufferSource)
    } catch {
        valid = false
    }
    if (!valid) return { ok: false, reason: 'invalid' }
    if (exp * 1000 <= now.getTime()) return { ok: false, reason: 'expired' }
    return { ok: true, orderId, expiresAt: new Date(exp * 1000) }
}

/** Absolute link for the e-mail (always the canonical apex host, with the trailing slash). */
export function reviewLinkUrl(token: string, origin: string = 'https://onopostore.com'): string {
    return `${origin.replace(/\/+$/, '')}${REVIEW_LINK_PATH}?t=${encodeURIComponent(token)}`
}
