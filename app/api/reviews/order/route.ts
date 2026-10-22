/**
 * POST /api/reviews/order/ { token, reviews: [{ productId, rating, comment? }] }: reviews through the signed
 * link of the review-request e-mail (/degerlendir/?t=<token>; lib/review-link.ts, lib/order-reviews.ts).
 *
 * No account needed: the token is the proof. Checks, in order: rate limit (REVIEW_RL binding, per IP; a
 * missing binding allows), token signature and expiry, migration applied, input (rating 1–5, comment ≤ 1000),
 * order status (approved / shipped / completed), every product in that order, no earlier review of that
 * product from this order. Stored with verified = 1 and the display name from the order ("Ayşe K.").
 *
 * Answers: 200 { success, created, duplicates }, 400 input, 401 invalid link, 403 order not reviewable,
 * 404 order gone, 409 all already reviewed, 410 link expired, 429 too many requests, 503 unavailable.
 */
import { NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'
import { clientKey } from '@/app/api/auth/login-limit'
import { guestReviewsReady, parseReviewInputs, submitOrderReviews, type ReviewsDb } from '@/lib/order-reviews'
import { verifyReviewToken } from '@/lib/review-link'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
    return NextResponse.json({ error, ...extra }, { status, headers })
}

export async function POST(req: Request) {
    const parsed = await readJsonBody(req)
    if (!parsed.ok) return parsed.response

    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })

    try {
        if (env.REVIEW_RL && !(await env.REVIEW_RL.limit({ key: `review:${clientKey(req.headers)}` })).success) {
            return fail(429, 'Çok fazla deneme. Lütfen biraz sonra tekrar dene.')
        }
    } catch {
        // A rate-limit outage must not block real customers; the signed token still has to be valid
    }

    const check = await verifyReviewToken(parsed.body.token, process.env.JWT_SECRET)
    if (!check.ok) {
        if (check.reason === 'expired') return fail(410, 'Bu değerlendirme bağlantısının süresi doldu.')
        if (check.reason === 'no_secret') return fail(503, 'Değerlendirmeler şu an geçici olarak kullanılamıyor.')
        return fail(401, 'Değerlendirme bağlantısı geçersiz.')
    }

    try {
        const db = env.DB as unknown as ReviewsDb
        if (!(await guestReviewsReady(db))) return fail(503, 'Değerlendirmeler şu an geçici olarak kullanılamıyor.')

        const input = parseReviewInputs(parsed.body)
        if (!input.ok) return fail(400, input.error)

        const result = await submitOrderReviews(db, check.orderId, input.reviews)
        if (!result.ok) return fail(result.status, result.error, result.duplicates ? { duplicates: result.duplicates } : {})

        // The product page and its cached copies show the new review on the next request (the edge cache key
        // carries this version; worker.ts only bumps it for logged-in writes)
        try {
            await env.DB.prepare("INSERT OR REPLACE INTO site_settings (key, value, updated_at) VALUES ('cache_version', ?, CURRENT_TIMESTAMP)")
                .bind(`${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
                .run()
        } catch (err) {
            console.error('review_cache_bump_failed', err instanceof Error ? err.message : 'error')
        }

        console.log(`order_reviews order=${check.orderId} created=${result.created.length} duplicates=${result.duplicates.length}`)
        return NextResponse.json({ success: true, created: result.created, duplicates: result.duplicates }, { headers })
    } catch (err) {
        console.error('order_reviews_failed', err instanceof Error ? err.message : 'error')
        return fail(500, 'Değerlendirme kaydedilemedi, lütfen tekrar dene.')
    }
}
