/**
 * Server helpers for the Admin › Yönlendirmeler API routes (app/api/admin/redirects/*): the D1 database with the
 * redirect tables ensured, a freshly built index (the admin must see today's products, not a 10-minute-old
 * isolate copy) and an R2 existence check for old image names, capped so one long list cannot fire hundreds
 * of R2 requests.
 */
import { getBucket, getDB } from './db'
import { ensureRedirectTables, loadIndex, type RedirectIndex, type RedirectsDb } from './redirects'

/** R2 HEADs per admin request (image suggestions beyond this are made from the product images only). */
const MAX_R2_CHECKS = 40

export const NO_STORE = { 'Cache-Control': 'private, no-store' }

export interface RedirectsAdminContext {
    db: RedirectsDb
    index: RedirectIndex
    imageExists: (key: string) => Promise<boolean>
}

export async function redirectsAdminContext(): Promise<RedirectsAdminContext> {
    const db = (await getDB()) as unknown as RedirectsDb
    await ensureRedirectTables(db)
    const index = await loadIndex(db, { fresh: true })
    let bucket: { head(key: string): Promise<unknown | null> } | null = null
    try {
        bucket = (await getBucket()) as unknown as { head(key: string): Promise<unknown | null> }
    } catch {
        bucket = null
    }
    let checks = 0
    const imageExists = async (key: string) => {
        if (!bucket || checks >= MAX_R2_CHECKS) return false
        checks++
        try {
            return (await bucket.head(key)) != null
        } catch {
            return false
        }
    }
    return { db, index, imageExists }
}

/** All admin redirects as a from → to map (the table is small: hand-made rows). */
export async function existingRedirects(db: RedirectsDb): Promise<Map<string, string>> {
    const { results } = await db.prepare('SELECT from_path, to_path FROM redirects').all<{ from_path: string; to_path: string }>()
    return new Map((results ?? []).map(r => [String(r.from_path), String(r.to_path)]))
}
