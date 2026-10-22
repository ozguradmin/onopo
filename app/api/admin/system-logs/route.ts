/**
 * /api/admin/system-logs/: the system log (lib/system-log.ts) for Admin › Sistem kayıtları (admin only).
 *
 * GET  ?summary=1                         → { unresolved: { error, warn, info } } (sidebar and dashboard badge)
 * GET  ?source=&level=&resolved=1&limit=  → { items, unresolved }: newest occurrence first; resolved=1 also
 *                                           lists the entries marked "Çözüldü"
 * POST { id }                             → marks one entry "Çözüldü" (it comes back if it happens again)
 * POST { all: true, source? }             → marks every open entry (of that source) "Çözüldü"
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { countUnresolved, listSystemLogs, resolveAllSystemLogs, resolveSystemLog } from '@/lib/system-log'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

async function getDb() {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare')
    const { env } = await getCloudflareContext({ async: true })
    return env.DB
}

export async function GET(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const db = await getDb()
        const url = new URL(req.url)
        const unresolved = await countUnresolved(db)
        if (url.searchParams.get('summary') === '1') return NextResponse.json({ unresolved }, { headers })
        const items = await listSystemLogs(db, {
            source: url.searchParams.get('source'),
            level: url.searchParams.get('level'),
            includeResolved: url.searchParams.get('resolved') === '1',
            limit: Number(url.searchParams.get('limit')) || 200,
        })
        return NextResponse.json({ items, unresolved }, { headers })
    } catch (err) {
        console.error('system_logs_read_failed', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'Kayıtlar okunamadı.' }, { status: 500, headers })
    }
}

export async function POST(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const body = (await req.json().catch(() => null)) as { id?: unknown; all?: unknown; source?: unknown } | null
        const db = await getDb()
        if (body?.all === true) {
            await resolveAllSystemLogs(db, typeof body.source === 'string' ? body.source : null)
        } else {
            const id = Number(body?.id)
            if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: 'Geçersiz kayıt.' }, { status: 400, headers })
            if (!(await resolveSystemLog(db, id))) return NextResponse.json({ error: 'Kayıt bulunamadı.' }, { status: 404, headers })
        }
        return NextResponse.json({ ok: true, unresolved: await countUnresolved(db) }, { headers })
    } catch (err) {
        console.error('system_logs_write_failed', err instanceof Error ? err.message : 'error')
        return NextResponse.json({ error: 'Kaydedilemedi.' }, { status: 500, headers })
    }
}
