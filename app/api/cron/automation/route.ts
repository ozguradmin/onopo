/**
 * POST /api/cron/automation/?job=reviews|indexnow|images|facts&ms=<time budget>: the daily automatic upkeep.
 *
 *  - job=reviews: the review-request e-mails, at most 20 orders per run, each order once
 *    (lib/order-reviews.ts, lib/review-requests-server.ts).
 *  - job=indexnow: one IndexNow POST with the sitemap URLs that are new, changed since they were last sent or
 *    gone from the sitemap (lib/indexnow.ts). The sitemap (app/sitemap.ts) is the list, so every page added to
 *    it later (guides, device pages …) is sent once by itself.
 *  - job=images: creates the missing WebP variants of the images the storefront shows (Cloudflare Images
 *    binding; lib/image-variants-server.ts), bounded per run.
 *  - job=facts: writes every missing or outdated assistant facts line, one DeepSeek call every 4 s, at most
 *    120 per run (lib/assistant/facts-auto.ts).
 *
 * Only the scheduled handler in worker.ts calls it, in-process, with `Authorization: Bearer <CRON_SECRET>`
 * like /api/cron/update-prices/. `ms` is the time this job may take (the cron has 15 minutes in all; the
 * route caps it). Failures are written to the system log (Admin › Sistem kayıtları) by the jobs themselves;
 * the JSON answer is for the Worker logs.
 */
import { NextResponse } from 'next/server'
import { sweepProductFacts } from '@/lib/assistant/data'
import { sweepImageVariants } from '@/lib/image-variants-server'
import { sweepReviewRequests } from '@/lib/review-requests-server'
import { runIndexNowSweep } from '@/lib/indexnow-server'
import sitemap from '@/app/sitemap'
import { logSystemEvent, type SystemLogDb } from '@/lib/system-log'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }
const MAX_MS: Record<string, number> = { reviews: 2 * 60_000, indexnow: 60_000, images: 4 * 60_000, facts: 9 * 60_000 }

export async function POST(req: Request) {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers })
    }
    const url = new URL(req.url)
    const job = url.searchParams.get('job') ?? ''
    if (!(job in MAX_MS)) return NextResponse.json({ error: 'unknown_job' }, { status: 400, headers })
    const asked = Number(url.searchParams.get('ms'))
    const budget = Math.max(10_000, Math.min(MAX_MS[job], Number.isFinite(asked) && asked > 0 ? asked : MAX_MS[job]))
    const deadline = Date.now() + budget
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        if (job === 'reviews') {
            const r = await sweepReviewRequests(env, deadline)
            const s = r as { stopped: string; candidates?: number; sent?: number; failed?: number }
            console.log(`automation_reviews stopped=${s.stopped} candidates=${s.candidates ?? '-'} sent=${s.sent ?? '-'} failed=${s.failed ?? '-'}`)
            return NextResponse.json({ job, stopped: s.stopped, candidates: s.candidates ?? null, sent: s.sent ?? 0, failed: s.failed ?? 0 }, { headers })
        }
        if (job === 'indexnow') {
            // The cron calls this in-process on NEXT_PUBLIC_BASE_URL and names that host in x-forwarded-host: the
            // in-process Request has no Host header, and the URL OpenNext rebuilds from it is not the production host
            // (the sweep skipped itself on every run until 2026-10-24)
            const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.hostname
            const entries = (await sitemap()).map(e => ({ url: e.url, lastModified: e.lastModified ?? null }))
            const r = await runIndexNowSweep(env, host, entries)
            console.log(`automation_indexnow host=${host} status=${r.status} changed=${r.changed} removed=${r.removed}`)
            if (r.status === 'skipped') {
                await logSystemEvent(env.DB as unknown as SystemLogDb, {
                    source: 'indexnow',
                    level: 'warn',
                    message: 'Arama motoru bildirimi (IndexNow) bu gece gönderilmedi.',
                    detail: `Anahtar ya da site adresi geçerli değil (host: ${host || '-'})`,
                })
            }
            return NextResponse.json({ job, host, ...r }, { headers })
        }
        if (job === 'images') {
            const r = await sweepImageVariants(env, deadline)
            const s = r as { stopped: string; missingImages?: number; done?: number; failed?: unknown[]; remaining?: number }
            console.log(`automation_images stopped=${s.stopped} missing=${s.missingImages ?? '-'} done=${s.done ?? '-'} failed=${s.failed?.length ?? '-'} remaining=${s.remaining ?? '-'}`)
            return NextResponse.json({ job, stopped: s.stopped, missing: s.missingImages ?? null, done: s.done ?? 0, failed: s.failed?.length ?? 0, remaining: s.remaining ?? null }, { headers })
        }
        const r = await sweepProductFacts(env, deadline)
        console.log(`automation_facts stopped=${r.stopped} stale=${r.stale} done=${r.done} failed=${r.failed.length} remaining=${r.remaining}`)
        return NextResponse.json({ job, stopped: r.stopped, stale: r.stale, done: r.done, failed: r.failed.length, remaining: r.remaining }, { headers })
    } catch (err) {
        console.error('automation_failed', job, err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'failed' }, { status: 500, headers })
    }
}
