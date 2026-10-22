/**
 * Admin › Yönlendirmeler › Bulunamayan sayfalar: the 404s nobody could resolve (D1 table not_found_log, written by
 * worker.ts for visitors and Googlebot), most visited first, each with the matcher's suggestion.
 *
 *   GET  ?view=open|ignored              → { rows: [{ path, hits, googlebotHits, firstSeen, lastSeen,
 *                                             referrerHost, suggestions }], openCount, ignoredCount }
 *   POST { action: 'ignore' | 'restore' | 'delete', paths: string[] } → { ok, changed }
 *
 * suggestions[0].kind 'auto': the site now redirects that address by itself (e.g. the product was added later).
 * Admin only; private, no-store.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { suggestTargets } from '@/lib/redirects'
import { NO_STORE, redirectsAdminContext } from '@/lib/redirects-server'

export const dynamic = 'force-dynamic'

const LIST_LIMIT = 200
const MAX_PATHS = 500

function fail(error: string, status = 400) {
    return NextResponse.json({ error }, { status, headers: NO_STORE })
}

export async function GET(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied
    const ignored = req.nextUrl.searchParams.get('view') === 'ignored' ? 1 : 0
    try {
        const { db, index, imageExists } = await redirectsAdminContext()
        const [{ results }, counts] = await Promise.all([
            db.prepare(
                `SELECT path, hits, googlebot_hits, first_seen, last_seen, last_referrer_host
                 FROM not_found_log WHERE ignored = ? ORDER BY hits DESC, last_seen DESC LIMIT ?`,
            ).bind(ignored, LIST_LIMIT).all<{
                path: string; hits: number; googlebot_hits: number; first_seen: string; last_seen: string; last_referrer_host: string | null
            }>(),
            db.prepare('SELECT ignored, COUNT(*) AS n FROM not_found_log GROUP BY ignored').all<{ ignored: number; n: number }>(),
        ])
        const rows = []
        for (const r of results ?? []) {
            rows.push({
                path: r.path,
                hits: Number(r.hits) || 0,
                googlebotHits: Number(r.googlebot_hits) || 0,
                firstSeen: r.first_seen,
                lastSeen: r.last_seen,
                referrerHost: r.last_referrer_host,
                suggestions: await suggestTargets(r.path, { index, imageExists }),
            })
        }
        const count = (flag: number) => Number((counts.results ?? []).find(c => Number(c.ignored) === flag)?.n ?? 0)
        return NextResponse.json({ rows, openCount: count(0), ignoredCount: count(1) }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects/not-found] list failed', error)
        return fail('Bulunamayan sayfalar yüklenemedi.', 500)
    }
}

export async function POST(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied
    let body: any
    try {
        body = await req.json()
    } catch {
        return fail('İstek okunamadı.')
    }
    const action = String(body?.action ?? '')
    const paths: string[] = Array.isArray(body?.paths) ? body.paths.filter((p: unknown): p is string => typeof p === 'string' && p.length <= 700) : []
    if (!['ignore', 'restore', 'delete'].includes(action)) return fail('Bilinmeyen işlem.')
    if (!paths.length) return fail('Adres seçilmedi.')
    if (paths.length > MAX_PATHS) return fail(`Bir seferde en fazla ${MAX_PATHS} adres.`)
    try {
        const { db } = await redirectsAdminContext()
        const sql = action === 'delete'
            ? 'DELETE FROM not_found_log WHERE path = ?'
            : 'UPDATE not_found_log SET ignored = ? WHERE path = ?'
        for (const path of paths) {
            const st = db.prepare(sql)
            await (action === 'delete' ? st.bind(path) : st.bind(action === 'ignore' ? 1 : 0, path)).run()
        }
        return NextResponse.json({ ok: true, changed: paths.length }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects/not-found] update failed', error)
        return fail('Değişiklik kaydedilemedi.', 500)
    }
}
