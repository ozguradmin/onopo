/**
 * The daily review-request job with the Worker env (rules and the pure parts: lib/order-reviews.ts).
 * Called by /api/cron/automation/?job=reviews (worker.ts scheduled handler). Never throws; what it could not do
 * goes to the system log (source "reviews").
 */
import 'server-only'
import { logSystemEvent, type SystemLogDb } from '@/lib/system-log'
import { sendReviewRequests, type ReviewRequestRun, type ReviewsDb } from '@/lib/order-reviews'
import { reviewLinkUrl, signReviewToken, usableReviewSecret } from '@/lib/review-link'
import { sendReviewRequestEmail } from '@/lib/email'

const ORIGIN = 'https://onopostore.com'

export async function sweepReviewRequests(env: CloudflareEnv, deadline: number): Promise<ReviewRequestRun | { stopped: 'no_secret' | 'no_mail' | 'exception' }> {
    const db = env.DB as unknown as ReviewsDb
    const logDb = env.DB as unknown as SystemLogDb
    try {
        const secret = process.env.JWT_SECRET
        if (!usableReviewSecret(secret)) {
            await logSystemEvent(logDb, { source: 'reviews', level: 'error', message: 'Değerlendirme e-postaları gönderilmedi: JWT_SECRET tanımlı değil, bağlantı imzalanamıyor.' })
            return { stopped: 'no_secret' }
        }
        if (!process.env.RESEND_API_KEY) {
            await logSystemEvent(logDb, { source: 'reviews', level: 'error', message: 'Değerlendirme e-postaları gönderilmedi: RESEND_API_KEY tanımlı değil.' })
            return { stopped: 'no_mail' }
        }
        return await sendReviewRequests(db, {
            origin: ORIGIN,
            deadline,
            linkFor: async orderId => reviewLinkUrl(await signReviewToken(orderId, secret), ORIGIN),
            send: sendReviewRequestEmail,
            log: event => logSystemEvent(logDb, event),
        })
    } catch (err) {
        await logSystemEvent(logDb, { source: 'reviews', level: 'error', message: 'Günlük değerlendirme e-postası işi çalışmadı.', detail: err instanceof Error ? err.message : 'error' })
        return { stopped: 'exception' }
    }
}
