/**
 * Reviews from real orders ("Doğrulanmış alıcı") and the review-request e-mail that asks for them.
 *
 * Why: most orders are guest checkouts, and a guest could not review at all (reviews.user_id was NOT NULL with a
 * foreign key to users). Real reviews are what gives the product pages and Google real stars.
 *
 * Flow:
 *  1. The daily cron (worker.ts → /api/cron/automation/?job=reviews → sendReviewRequests) picks delivered orders
 *     (status completed, or shipped at least 7 days ago) placed 5–45 days ago that have no review_requests row
 *     and an e-mail address, at most 20 per run, and sends ONE e-mail per order with a signed link
 *     (lib/review-link.ts). The review_requests row (no e-mail address in it) makes sure it is sent only once.
 *  2. /degerlendir/?t=<token> shows the order's products with 1–5 stars and an optional comment each
 *     (loadOrderForReview), POST /api/reviews/order/ stores them (submitOrderReviews) with verified = 1, the
 *     order id and the display name ("Ayşe K.", from the order's shipping name; the full name is never stored).
 *
 * Schema: migrations/2026-10-22-guest-reviews.sql (reviews.user_id nullable + order_id, reviewer_name, verified;
 * UNIQUE(order_id, product_id); table review_requests). Until it has run, guestReviewsReady() is false: the link
 * page says reviews are temporarily unavailable, the POST answers 503, the cron job logs once and skips, and the
 * product page reads the old columns (listProductReviews).
 *
 * Pure apart from the injected database and the injected mail sender (tests pass node:sqlite and fakes).
 */
import { absoluteImageUrl } from './images'
import type { SystemLogEvent } from './system-log'

/** Orders whose products may be reviewed through a link (paid and not cancelled). */
export const REVIEWABLE_ORDER_STATUSES = ['approved', 'shipped', 'completed'] as const
export const REVIEW_COMMENT_MAX = 1000
/** E-mails per daily run. */
export const REVIEW_REQUEST_BATCH = 20
/** Window for the request e-mail, in days after the order was placed. */
export const REVIEW_REQUEST_MIN_AGE_DAYS = 5
export const REVIEW_REQUEST_MAX_AGE_DAYS = 45
/** A "shipped" order (never marked completed) is asked only this long after it was placed. */
export const REVIEW_REQUEST_SHIPPED_MIN_AGE_DAYS = 7
/** Pause between two e-mails (Resend allows 2 requests per second). */
export const REVIEW_REQUEST_GAP_MS = 600
export const REVIEW_REQUESTS_SETTING = 'review_requests_enabled'
/** This many rejected addresses in a row stop the run: the cause is then the sender, not the addresses. */
export const REVIEW_REQUEST_MAX_REJECTED_IN_A_ROW = 3

const DAY_MS = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------------------------
// Database access (a real D1Database satisfies these)
// ---------------------------------------------------------------------------------------------

export interface ReviewsStmt {
    bind(...values: unknown[]): ReviewsStmt
    run(): Promise<{ meta?: { changes?: number; last_row_id?: number } } | unknown>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
export interface ReviewsDb {
    prepare(sql: string): ReviewsStmt
}

function changesOf(result: unknown): number {
    const meta = (result as { meta?: { changes?: number } } | null)?.meta
    return Number(meta?.changes ?? 0)
}

/** D1 / SQLite timestamp format of CURRENT_TIMESTAMP (UTC), so string comparison orders correctly. */
export function sqlTime(d: Date): string {
    return d.toISOString().replace('T', ' ').slice(0, 19)
}

// ---------------------------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------------------------

/** First name (capitalised) + last-name initial ("Ünal Mert" → "Ünal M."); "Onopo müşterisi" when unknown. */
export function maskReviewerName(fullName: unknown): string {
    const parts = String(fullName ?? '').trim().split(/\s+/).filter(Boolean)
    if (!parts.length) return 'Onopo müşterisi'
    const first = parts[0]
    // "AYŞE" → "Ayşe", "ayşe" → "Ayşe"; a mixed-case name is kept as typed
    const rest = first === first.toLocaleUpperCase('tr-TR') ? first.slice(1).toLocaleLowerCase('tr-TR') : first.slice(1)
    const firstNice = first.charAt(0).toLocaleUpperCase('tr-TR') + rest
    if (parts.length === 1) return firstNice
    const last = parts[parts.length - 1]
    return `${firstNice} ${last.charAt(0).toLocaleUpperCase('tr-TR')}.`
}

/** The shipping name of an order (orders.shipping_address JSON, `fullName`), or '' when missing. */
export function shippingFullName(shippingAddress: unknown): string {
    try {
        const parsed = typeof shippingAddress === 'string' ? JSON.parse(shippingAddress) : shippingAddress
        const name = parsed && typeof parsed === 'object' ? (parsed as { fullName?: unknown }).fullName : ''
        return typeof name === 'string' ? name.replace(/\s+/g, ' ').trim().slice(0, 120) : ''
    } catch {
        return ''
    }
}

/** How a review from this order is signed on the product page ("Ayşe K."). */
export function reviewerNameFromShipping(shippingAddress: unknown): string {
    return maskReviewerName(shippingFullName(shippingAddress))
}

/** Greeting name for the e-mail: the first name only, '' when unknown. */
export function firstNameFromShipping(shippingAddress: unknown): string {
    const full = shippingFullName(shippingAddress)
    return full ? maskReviewerName(full).split(' ')[0] : ''
}

// ---------------------------------------------------------------------------------------------
// Schema readiness (the migration may not have run yet)
// ---------------------------------------------------------------------------------------------

let readyMemo: { value: boolean; at: number } | null = null
const NOT_READY_RECHECK_MS = 60_000

/**
 * Whether migrations/2026-10-22-guest-reviews.sql has run: the new reviews columns and review_requests exist.
 * A positive answer is kept for the isolate (columns never disappear); a negative one is checked again after
 * a minute. Never throws.
 */
export async function guestReviewsReady(db: ReviewsDb, now: number = Date.now()): Promise<boolean> {
    if (readyMemo && (readyMemo.value || now - readyMemo.at < NOT_READY_RECHECK_MS)) return readyMemo.value
    let value = false
    try {
        await db.prepare('SELECT order_id, reviewer_name, verified FROM reviews LIMIT 1').first()
        await db.prepare('SELECT order_id, sent_at, status, error FROM review_requests LIMIT 1').first()
        value = true
    } catch {
        value = false
    }
    readyMemo = { value, at: now }
    return value
}

/** Tests: forget the readiness memo. */
export function resetGuestReviewsMemo(): void {
    readyMemo = null
}

// ---------------------------------------------------------------------------------------------
// Product page: reviews of one product
// ---------------------------------------------------------------------------------------------

export interface PublicReview {
    id: number
    product_id: number
    rating: number
    comment: string
    created_at: string | null
    /** "Ünal M.": masked account name, or the stored display name of a review from an order link. */
    author: string
    /** Written through the review link of a real order. */
    verified: boolean
}

/**
 * Every review of a product, newest first, with public data only (no user_id, no order id, no full name).
 * Works before and after the migration. Throws when D1 fails (callers decide how to degrade).
 */
export async function listProductReviews(db: ReviewsDb, productId: number): Promise<PublicReview[]> {
    const ready = await guestReviewsReady(db)
    const sql = ready
        ? `SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, r.reviewer_name, r.verified, u.full_name
           FROM reviews r LEFT JOIN users u ON r.user_id = u.id
           WHERE r.product_id = ?
           ORDER BY r.created_at DESC, r.id DESC`
        : `SELECT r.id, r.product_id, r.rating, r.comment, r.created_at, u.full_name
           FROM reviews r LEFT JOIN users u ON r.user_id = u.id
           WHERE r.product_id = ?
           ORDER BY r.created_at DESC, r.id DESC`
    const { results } = await db.prepare(sql).bind(productId).all<Record<string, unknown>>()
    return (results ?? [])
        .map(r => {
            const stored = typeof r.reviewer_name === 'string' ? r.reviewer_name.trim() : ''
            return {
                id: Number(r.id),
                product_id: Number(r.product_id),
                rating: Math.max(1, Math.min(5, Math.round(Number(r.rating) || 0))),
                comment: String(r.comment ?? '').trim(),
                created_at: r.created_at ? String(r.created_at) : null,
                // An account's name is masked here; a link review already stores the masked form
                author: r.full_name ? maskReviewerName(r.full_name) : stored || 'Onopo müşterisi',
                verified: Number(r.verified) === 1,
            }
        })
        .filter(r => Number.isFinite(r.rating) && r.rating >= 1)
}

// ---------------------------------------------------------------------------------------------
// Review link page and POST
// ---------------------------------------------------------------------------------------------

export interface ReviewableItem {
    product_id: number
    name: string
    slug: string | null
    /** Stored image reference ("/api/images/<key>") or null. */
    image: string | null
    /** Linked only while the product is active. */
    active: boolean
    /** A review from this order already exists for this product. */
    reviewed: boolean
}

export interface ReviewableOrder {
    id: number
    /** Status allows reviews (approved / shipped / completed). */
    reviewable: boolean
    /** Display name the reviews will carry ("Ayşe K."). */
    reviewerName: string
    items: ReviewableItem[]
}

function parseFirstImage(images: unknown): string | null {
    try {
        const list = typeof images === 'string' ? JSON.parse(images) : images
        const first = Array.isArray(list) ? list.find(i => typeof i === 'string' && i.trim()) : null
        return first ? String(first) : null
    } catch {
        return null
    }
}

/** Distinct products of an order that still exist, in order-item order. */
async function orderProducts(db: ReviewsDb, orderId: number): Promise<Array<Omit<ReviewableItem, 'reviewed'>>> {
    const { results } = await db
        .prepare(
            `SELECT p.id, p.name, p.slug, p.images, p.is_active
             FROM order_items oi JOIN products p ON p.id = oi.product_id
             WHERE oi.order_id = ?
             ORDER BY oi.id ASC`,
        )
        .bind(orderId)
        .all<Record<string, unknown>>()
    const seen = new Set<number>()
    const out: Array<Omit<ReviewableItem, 'reviewed'>> = []
    for (const r of results ?? []) {
        const id = Number(r.id)
        if (!Number.isInteger(id) || seen.has(id)) continue
        seen.add(id)
        out.push({
            product_id: id,
            name: String(r.name ?? ''),
            slug: r.slug ? String(r.slug) : null,
            image: parseFirstImage(r.images),
            active: Number(r.is_active ?? 1) === 1,
        })
    }
    return out
}

/** The order behind a verified review link, or null when it does not exist. Needs guestReviewsReady(). */
export async function loadOrderForReview(db: ReviewsDb, orderId: number): Promise<ReviewableOrder | null> {
    const order = await db
        .prepare('SELECT id, status, shipping_address FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ id: number; status: string | null; shipping_address: string | null }>()
    if (!order) return null
    const products = await orderProducts(db, orderId)
    const { results } = await db.prepare('SELECT product_id FROM reviews WHERE order_id = ?').bind(orderId).all<{ product_id: number }>()
    const reviewed = new Set((results ?? []).map(r => Number(r.product_id)))
    return {
        id: Number(order.id),
        reviewable: (REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(String(order.status ?? '')),
        reviewerName: reviewerNameFromShipping(order.shipping_address),
        items: products.map(p => ({ ...p, reviewed: reviewed.has(p.product_id) })),
    }
}

export interface ReviewInput {
    productId: number
    rating: number
    comment: string
}

/** Strips control characters (keeps line breaks), trims, collapses runs of blank lines. */
export function cleanReviewComment(value: unknown): string {
    return String(value ?? '')
        .replace(/\r\n?/g, '\n')
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}

/**
 * Validates the POST body `{ token, reviews: [{ productId, rating, comment? }] }` (token checked elsewhere).
 * Ratings must be whole numbers 1–5, comments at most REVIEW_COMMENT_MAX characters, each product once.
 */
export function parseReviewInputs(body: unknown): { ok: true; reviews: ReviewInput[] } | { ok: false; error: string } {
    const list = (body as { reviews?: unknown } | null)?.reviews
    if (!Array.isArray(list) || list.length === 0) return { ok: false, error: 'En az bir ürüne puan ver.' }
    if (list.length > 50) return { ok: false, error: 'Geçersiz istek.' }
    const out: ReviewInput[] = []
    const seen = new Set<number>()
    for (const raw of list) {
        const item = raw as { productId?: unknown; rating?: unknown; comment?: unknown } | null
        const productId = Number(item?.productId)
        const rating = Number(item?.rating)
        if (!Number.isSafeInteger(productId) || productId <= 0 || seen.has(productId)) return { ok: false, error: 'Geçersiz ürün.' }
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: 'Puan 1 ile 5 arasında olmalı.' }
        if (item?.comment != null && typeof item.comment !== 'string') return { ok: false, error: 'Geçersiz yorum.' }
        const comment = cleanReviewComment(item?.comment)
        if (comment.length > REVIEW_COMMENT_MAX) return { ok: false, error: `Yorum en fazla ${REVIEW_COMMENT_MAX} karakter olabilir.` }
        seen.add(productId)
        out.push({ productId, rating, comment })
    }
    return { ok: true, reviews: out }
}

export type SubmitResult =
    | { ok: true; created: number[]; duplicates: number[] }
    | { ok: false; status: 400 | 403 | 404 | 409; error: string; duplicates?: number[] }

function isUniqueViolation(err: unknown): boolean {
    return /UNIQUE constraint failed/i.test(err instanceof Error ? err.message : String(err))
}

/**
 * Stores the reviews of one order (token already verified, inputs from parseReviewInputs). Every product must be
 * in the order; a product this order already reviewed (or, for an account order, that the account already
 * reviewed) is skipped as a duplicate. All duplicates → 409. Needs guestReviewsReady().
 */
export async function submitOrderReviews(db: ReviewsDb, orderId: number, inputs: ReviewInput[]): Promise<SubmitResult> {
    const order = await db
        .prepare('SELECT id, status, user_id, shipping_address FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ id: number; status: string | null; user_id: number | null; shipping_address: string | null }>()
    if (!order) return { ok: false, status: 404, error: 'Sipariş bulunamadı.' }
    if (!(REVIEWABLE_ORDER_STATUSES as readonly string[]).includes(String(order.status ?? ''))) {
        return { ok: false, status: 403, error: 'Bu sipariş için değerlendirme yapılamıyor.' }
    }
    const inOrder = new Set((await orderProducts(db, orderId)).map(p => p.product_id))
    if (inputs.some(i => !inOrder.has(i.productId))) return { ok: false, status: 400, error: 'Bu ürün siparişinde yok.' }

    const userId = order.user_id != null && Number(order.user_id) > 0 ? Number(order.user_id) : null
    const reviewerName = reviewerNameFromShipping(order.shipping_address)
    const created: number[] = []
    const duplicates: number[] = []
    for (const input of inputs) {
        const existing = await db
            .prepare(
                userId
                    ? 'SELECT id FROM reviews WHERE product_id = ? AND (order_id = ? OR user_id = ?) LIMIT 1'
                    : 'SELECT id FROM reviews WHERE product_id = ? AND order_id = ? LIMIT 1',
            )
            .bind(...(userId ? [input.productId, orderId, userId] : [input.productId, orderId]))
            .first()
        if (existing) {
            duplicates.push(input.productId)
            continue
        }
        try {
            // user_id only while that account still exists (the foreign key would reject a deleted one)
            await db
                .prepare(
                    `INSERT INTO reviews (product_id, user_id, rating, comment, order_id, reviewer_name, verified)
                     VALUES (?, (SELECT id FROM users WHERE id = ?), ?, ?, ?, ?, 1)`,
                )
                .bind(input.productId, userId, input.rating, input.comment, orderId, reviewerName)
                .run()
            created.push(input.productId)
        } catch (err) {
            // Two submits at once: the UNIQUE(order_id, product_id) constraint lets only one through
            if (isUniqueViolation(err)) duplicates.push(input.productId)
            else throw err
        }
    }
    if (!created.length) return { ok: false, status: 409, error: 'Bu ürünleri zaten değerlendirdin.', duplicates }
    return { ok: true, created, duplicates }
}

// ---------------------------------------------------------------------------------------------
// Review-request e-mails (daily cron)
// ---------------------------------------------------------------------------------------------

/** Off only when the admin switched it off (Admin › Yorumlar); a missing row means on. */
export async function isReviewRequestsEnabled(db: ReviewsDb): Promise<boolean> {
    const row = await db.prepare('SELECT value FROM site_settings WHERE key = ?').bind(REVIEW_REQUESTS_SETTING).first<{ value: unknown }>()
    if (!row) return true
    const v = String(row.value ?? '').trim().toLowerCase()
    return !['0', 'false', 'off', 'no', 'hayir', 'hayır'].includes(v)
}

export interface ReviewRequestCandidate {
    id: number
    created_at: string
    shipping_address: string | null
    email: string
}

/**
 * Orders to ask today: status completed, or shipped and placed at least 7 days ago; placed 5–45 days ago; not
 * failed; no review_requests row yet; an e-mail address (the checkout address, else the account's); at least
 * one product that still exists. Oldest first, so nobody drops out of the window unasked.
 */
export async function selectReviewRequestCandidates(db: ReviewsDb, now: Date, limit: number = REVIEW_REQUEST_BATCH): Promise<ReviewRequestCandidate[]> {
    const t = now.getTime()
    const newest = sqlTime(new Date(t - REVIEW_REQUEST_MIN_AGE_DAYS * DAY_MS))
    const oldest = sqlTime(new Date(t - REVIEW_REQUEST_MAX_AGE_DAYS * DAY_MS))
    const shippedBefore = sqlTime(new Date(t - REVIEW_REQUEST_SHIPPED_MIN_AGE_DAYS * DAY_MS))
    const { results } = await db
        .prepare(
            `SELECT o.id, o.created_at, o.shipping_address,
                    COALESCE(NULLIF(TRIM(o.guest_email), ''), NULLIF(TRIM(u.email), '')) AS email
             FROM orders o LEFT JOIN users u ON u.id = o.user_id
             WHERE (o.status = 'completed' OR (o.status = 'shipped' AND o.created_at <= ?))
               AND o.created_at <= ? AND o.created_at >= ?
               AND COALESCE(o.payment_status, '') <> 'failed'
               AND NOT EXISTS (SELECT 1 FROM review_requests rr WHERE rr.order_id = o.id)
               AND COALESCE(NULLIF(TRIM(o.guest_email), ''), NULLIF(TRIM(u.email), '')) IS NOT NULL
               AND EXISTS (SELECT 1 FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id)
             ORDER BY o.created_at ASC, o.id ASC
             LIMIT ?`,
        )
        .bind(shippedBefore, newest, oldest, Math.max(1, Math.min(100, Math.trunc(limit))))
        .all<Record<string, unknown>>()
    return (results ?? [])
        .map(r => ({
            id: Number(r.id),
            created_at: String(r.created_at ?? ''),
            shipping_address: r.shipping_address == null ? null : String(r.shipping_address),
            email: String(r.email ?? '').trim(),
        }))
        .filter(c => Number.isInteger(c.id) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email))
}

/** What the e-mail template gets (lib/email.ts reviewRequestTemplate). */
export interface ReviewRequestMail {
    orderId: number
    firstName: string
    reviewUrl: string
    items: Array<{ name: string; imageUrl: string | null; url: string | null }>
}

/**
 * Result of one send. `permanent` failures (the address was rejected) are recorded as failed and never retried;
 * any other failure (no API key, rate limit, Resend down) releases the order for a later run and stops this run.
 */
export type ReviewMailResult = { ok: true } | { ok: false; permanent: boolean; error: string }

export interface ReviewRequestDeps {
    now?: Date
    /** Signs the link for an order (lib/review-link.ts signReviewToken + reviewLinkUrl). */
    linkFor(orderId: number): Promise<string>
    send(to: string, mail: ReviewRequestMail): Promise<ReviewMailResult>
    log(event: SystemLogEvent): Promise<void>
    sleep?(ms: number): Promise<void>
    origin?: string
    limit?: number
    /** Stop starting new e-mails after this time (ms since epoch). */
    deadline?: number
}

export interface ReviewRequestRun {
    stopped: 'done' | 'disabled' | 'not_ready' | 'send_failed' | 'deadline'
    candidates: number
    sent: number
    failed: number
}

/**
 * Whether a Resend error is about this one recipient (the order is recorded as failed and never retried) and not
 * about the account, the sender domain or the service (the order is released and tried again another day).
 * Resend answers validation_error for both kinds ("Invalid `to` field" and "The domain is not verified"), so
 * the message decides; when in doubt it is not permanent, so no order is given up because of our own setup.
 */
export function isPermanentMailError(name: unknown, message: unknown): boolean {
    const n = String(name ?? '').trim()
    const m = String(message ?? '')
    if (n === 'invalid_to_address') return true
    if (n !== 'validation_error') return false
    if (/from|domain|api[ _-]?key|testing emails|own email|quota|rate/i.test(m)) return false
    return /`to`|to field|recipient|e-?mail address/i.test(m)
}

/** No e-mail address (or anything that looks like one) in a stored error text. */
export function sanitizeMailError(text: unknown): string {
    return String(text ?? 'error')
        .replace(/[^\s@<>"'`]+@[^\s@<>"'`]+/g, '<e-posta>')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200) || 'error'
}

/** The products of a candidate order for the e-mail: name, absolute image, product page link (active only). */
async function mailItems(db: ReviewsDb, orderId: number, origin: string): Promise<ReviewRequestMail['items']> {
    return (await orderProducts(db, orderId)).map(p => ({
        name: p.name,
        imageUrl: p.image ? absoluteImageUrl(p.image, origin) : null,
        url: p.active && p.slug ? `${origin}/${encodeURIComponent(p.slug)}/` : null,
    }))
}

/**
 * The daily job. Never sends an order twice: the review_requests row is claimed (INSERT OR IGNORE) before the
 * e-mail goes out and stays as `sent` or `failed`; a transient failure deletes the claim so a later run retries.
 */
export async function sendReviewRequests(db: ReviewsDb, deps: ReviewRequestDeps): Promise<ReviewRequestRun> {
    const now = deps.now ?? new Date()
    const run: ReviewRequestRun = { stopped: 'done', candidates: 0, sent: 0, failed: 0 }
    if (!(await guestReviewsReady(db, now.getTime()))) {
        await deps.log({ source: 'reviews', level: 'warn', message: 'Değerlendirme e-postaları gönderilmedi: veritabanı güncellemesi (2026-10-22-guest-reviews.sql) henüz çalıştırılmadı.' })
        return { ...run, stopped: 'not_ready' }
    }
    if (!(await isReviewRequestsEnabled(db))) return { ...run, stopped: 'disabled' }

    const origin = (deps.origin ?? 'https://onopostore.com').replace(/\/+$/, '')
    const candidates = await selectReviewRequestCandidates(db, now, deps.limit ?? REVIEW_REQUEST_BATCH)
    run.candidates = candidates.length
    const sleep = deps.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)))
    let first = true
    let rejectedInARow = 0
    for (const c of candidates) {
        if (deps.deadline && Date.now() > deps.deadline) {
            run.stopped = 'deadline'
            break
        }
        // Claim the order first: a second run at the same time (or a crash after sending) never sends it again
        const claim = await db
            .prepare("INSERT OR IGNORE INTO review_requests (order_id, sent_at, status, error) VALUES (?, ?, 'sending', NULL)")
            .bind(c.id, now.toISOString())
            .run()
        if (changesOf(claim) !== 1) continue
        if (!first) await sleep(REVIEW_REQUEST_GAP_MS)
        first = false

        let result: ReviewMailResult
        try {
            const items = await mailItems(db, c.id, origin)
            const reviewUrl = await deps.linkFor(c.id)
            result = await deps.send(c.email, { orderId: c.id, firstName: firstNameFromShipping(c.shipping_address), reviewUrl, items })
        } catch (err) {
            result = { ok: false, permanent: false, error: err instanceof Error ? err.message : String(err) }
        }

        if (result.ok) {
            await db.prepare("UPDATE review_requests SET status = 'sent', sent_at = ?, error = NULL WHERE order_id = ?").bind(new Date().toISOString(), c.id).run()
            run.sent++
            rejectedInARow = 0
        } else if (result.permanent) {
            await db.prepare("UPDATE review_requests SET status = 'failed', error = ? WHERE order_id = ?").bind(sanitizeMailError(result.error), c.id).run()
            run.failed++
            await deps.log({ source: 'reviews', level: 'warn', message: 'Bir siparişin değerlendirme e-postası gönderilemedi (adres reddedildi).', detail: sanitizeMailError(result.error), ref: `order:${c.id}` })
            // Several rejected addresses in a row point at our sending setup: stop before more orders are given up
            if (++rejectedInARow >= REVIEW_REQUEST_MAX_REJECTED_IN_A_ROW) {
                await deps.log({ source: 'reviews', level: 'error', message: `Art arda ${rejectedInARow} değerlendirme e-postası reddedildi; iş durduruldu. Resend ayarlarını (gönderen alan adı) kontrol edin.`, detail: sanitizeMailError(result.error) })
                run.stopped = 'send_failed'
                break
            }
        } else {
            // Not this customer's fault: give the order back and try again on another day
            await db.prepare("DELETE FROM review_requests WHERE order_id = ? AND status = 'sending'").bind(c.id).run()
            await deps.log({ source: 'reviews', level: 'error', message: 'Değerlendirme e-postaları gönderilemedi; yarın tekrar denenecek.', detail: sanitizeMailError(result.error) })
            run.stopped = 'send_failed'
            break
        }
    }
    return run
}

export interface ReviewRequestStats {
    /** Migration has run. */
    ready: boolean
    enabled: boolean
    days: number
    sent: number
    failed: number
    /** Reviews written through order links in the same period. */
    reviews: number
}

/** Admin › Yorumlar: the switch and the last `days` days' numbers. Never throws. */
export async function reviewRequestStats(db: ReviewsDb, now: Date = new Date(), days: number = 30): Promise<ReviewRequestStats> {
    const empty: ReviewRequestStats = { ready: false, enabled: true, days, sent: 0, failed: 0, reviews: 0 }
    try {
        empty.enabled = await isReviewRequestsEnabled(db)
    } catch {
        // keep the default
    }
    if (!(await guestReviewsReady(db, now.getTime()))) return empty
    try {
        const since = new Date(now.getTime() - days * DAY_MS)
        const row = await db
            .prepare(
                `SELECT
                    (SELECT COUNT(*) FROM review_requests WHERE status = 'sent' AND sent_at >= ?) AS sent,
                    (SELECT COUNT(*) FROM review_requests WHERE status = 'failed' AND sent_at >= ?) AS failed,
                    (SELECT COUNT(*) FROM reviews WHERE order_id IS NOT NULL AND created_at >= ?) AS reviews`,
            )
            .bind(since.toISOString(), since.toISOString(), sqlTime(since))
            .first<{ sent: number; failed: number; reviews: number }>()
        return { ...empty, ready: true, sent: Number(row?.sent ?? 0), failed: Number(row?.failed ?? 0), reviews: Number(row?.reviews ?? 0) }
    } catch {
        return { ...empty, ready: true }
    }
}
