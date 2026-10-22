/**
 * IndexNow from the admin routes and the daily cron (rules and the protocol in lib/indexnow.ts).
 *
 * notifyIndexNow(req.url, change) is called after a successful admin write. It returns at once: the URLs are
 * worked out and sent in ctx.waitUntil (lib/automation/background.ts), as ONE POST per save, and recorded in
 * indexnow_urls so the daily sweep does not send them again. Off outside production (lib/indexnow.ts
 * indexNowEnabled: key, host, NODE_ENV).
 */
import 'server-only'
import { runInBackground } from '@/lib/automation/background'
import {
    isIndexNowHost,
    isValidIndexNowKey,
    pathsForChange,
    submitUrls,
    sweepIndexNow,
    type IndexNowChange,
    type SitemapEntryLike,
    type SweepResult,
} from '@/lib/indexnow'
import type { SystemLogDb } from '@/lib/system-log'

function hostOf(requestUrl: string): string | null {
    try {
        return new URL(requestUrl).hostname
    } catch {
        return null
    }
}

/** After an admin save: tell the search engines which pages changed. Never throws, never delays the answer. */
export async function notifyIndexNow(requestUrl: string, change: IndexNowChange): Promise<void> {
    const host = hostOf(requestUrl)
    const nodeEnv = process.env.NODE_ENV
    // A local build (127.0.0.1, next dev) never even schedules the task; the key is checked by submitUrls
    if (!isIndexNowHost(host, nodeEnv)) return
    await runInBackground('indexnow', async env => {
        const db = env.DB as unknown as SystemLogDb
        const key = env.INDEXNOW_KEY ?? process.env.INDEXNOW_KEY
        if (!isValidIndexNowKey(key)) return
        const paths = await pathsForChange(db, change)
        await submitUrls(paths, { key, host, nodeEnv, db, record: true })
    })
}

/** The daily cron step (app/api/cron/automation, job=indexnow). `entries` = the sitemap. */
export async function runIndexNowSweep(env: CloudflareEnv, host: string, entries: SitemapEntryLike[]): Promise<SweepResult> {
    return sweepIndexNow(env.DB as unknown as SystemLogDb, entries, {
        key: env.INDEXNOW_KEY ?? process.env.INDEXNOW_KEY,
        host,
        nodeEnv: process.env.NODE_ENV,
    })
}
