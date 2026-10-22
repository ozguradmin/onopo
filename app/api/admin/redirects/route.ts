/**
 * Admin › Yönlendirmeler: the hand-made redirects (D1 table redirects, used by worker.ts for URLs that answer 404).
 *
 *   GET                                  → { redirects: [{ from, to, note, hits, lastHitAt, createdAt, live }] }
 *   POST   { from, to, note? }           → add one
 *   POST   { items: [{ from, to, note? }] } → add many (Search Console list, "Önerilene yönlendir" in bulk)
 *          → { saved, errors: [{ from, error }] }; an existing row is never overwritten here (use PUT)
 *   PUT    { originalFrom, from, to, note? } → edit one (the old address may change too)
 *   DELETE ?from=<stored from_path>      → delete one
 *
 * Every row is checked with validateRedirect (lib/redirects.ts): the old address must be ours and not open today,
 * the new one must be a live page (or our image host). A saved address leaves the "Bulunamayan sayfalar" list.
 * Admin only; private, no-store.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { isLiveTarget, validateRedirect, type RedirectsDb, type RedirectsStmt } from '@/lib/redirects'
import { existingRedirects, NO_STORE, redirectsAdminContext } from '@/lib/redirects-server'

export const dynamic = 'force-dynamic'

const MAX_ITEMS = 1000
const MAX_NOTE = 300

function fail(error: string, status = 400) {
    return NextResponse.json({ error }, { status, headers: NO_STORE })
}

function cleanNote(note: unknown): string | null {
    const s = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE) : ''
    return s || null
}

/** The insert of a new row, plus its removal from the 404 list (handled now). */
function insertStatements(db: RedirectsDb, from: string, to: string, note: string | null): RedirectsStmt[] {
    return [
        db.prepare('INSERT OR IGNORE INTO redirects (from_path, to_path, note) VALUES (?, ?, ?)').bind(from, to, note),
        db.prepare('DELETE FROM not_found_log WHERE path = ?').bind(from),
    ]
}

/** D1 batches (100 statements a round trip); one by one where batch is missing. */
async function runAll(db: RedirectsDb, statements: RedirectsStmt[]): Promise<void> {
    const batch = (db as RedirectsDb & { batch?: (s: RedirectsStmt[]) => Promise<unknown> }).batch
    for (let i = 0; i < statements.length; i += 100) {
        const chunk = statements.slice(i, i + 100)
        if (batch) await batch.call(db, chunk)
        else for (const st of chunk) await st.run()
    }
}

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied
    try {
        const { db, index } = await redirectsAdminContext()
        const { results } = await db
            .prepare('SELECT from_path, to_path, note, hits, last_hit_at, created_at FROM redirects ORDER BY created_at DESC, from_path')
            .all<{ from_path: string; to_path: string; note: string | null; hits: number; last_hit_at: string | null; created_at: string }>()
        const redirects = (results ?? []).map(r => ({
            from: r.from_path,
            to: r.to_path,
            note: r.note,
            hits: Number(r.hits) || 0,
            lastHitAt: r.last_hit_at,
            createdAt: r.created_at,
            // false: the target no longer opens (deleted product …); the redirect is skipped until it is fixed
            live: isLiveTarget(r.to_path, index),
        }))
        return NextResponse.json({ redirects }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects] list failed', error)
        return fail('Yönlendirmeler yüklenemedi.', 500)
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
    const items: Array<{ from?: unknown; to?: unknown; note?: unknown }> = Array.isArray(body?.items)
        ? body.items
        : [{ from: body?.from, to: body?.to, note: body?.note }]
    if (!items.length) return fail('Kaydedilecek yönlendirme yok.')
    if (items.length > MAX_ITEMS) return fail(`Bir seferde en fazla ${MAX_ITEMS} yönlendirme kaydedilebilir.`)
    try {
        const { db, index } = await redirectsAdminContext()
        const existing = await existingRedirects(db)
        const errors: Array<{ from: string; error: string }> = []
        const statements: RedirectsStmt[] = []
        const seen = new Set<string>()
        for (const item of items) {
            const fromRaw = String(item?.from ?? '')
            const v = validateRedirect(fromRaw, String(item?.to ?? ''), index)
            if (!v.ok) {
                errors.push({ from: fromRaw, error: v.error })
                continue
            }
            if (seen.has(v.from)) continue
            seen.add(v.from)
            if (existing.has(v.from)) {
                errors.push({ from: v.from, error: 'Bu eski adres için zaten bir yönlendirme var. Listeden düzenleyebilirsiniz.' })
                continue
            }
            statements.push(...insertStatements(db, v.from, v.to, cleanNote(item?.note)))
        }
        await runAll(db, statements)
        const saved = statements.length / 2
        // A single add answers with its own error as a normal failure
        if (!Array.isArray(body?.items) && errors.length) return fail(errors[0].error)
        return NextResponse.json({ saved, errors }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects] save failed', error)
        return fail('Yönlendirme kaydedilemedi.', 500)
    }
}

export async function PUT(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied
    let body: any
    try {
        body = await req.json()
    } catch {
        return fail('İstek okunamadı.')
    }
    const originalFrom = String(body?.originalFrom ?? '')
    if (!originalFrom) return fail('Düzenlenecek yönlendirme belirtilmedi.')
    try {
        const { db, index } = await redirectsAdminContext()
        const current = await db.prepare('SELECT from_path FROM redirects WHERE from_path = ?').bind(originalFrom).first()
        if (!current) return fail('Bu yönlendirme bulunamadı (silinmiş olabilir).', 404)
        const v = validateRedirect(String(body?.from ?? originalFrom), String(body?.to ?? ''), index)
        if (!v.ok) return fail(v.error)
        const note = cleanNote(body?.note)
        if (v.from === originalFrom) {
            await db.prepare('UPDATE redirects SET to_path = ?, note = ? WHERE from_path = ?').bind(v.to, note, originalFrom).run()
        } else {
            const clash = await db.prepare('SELECT from_path FROM redirects WHERE from_path = ?').bind(v.from).first()
            if (clash) return fail('Bu eski adres için zaten başka bir yönlendirme var.')
            await runAll(db, [db.prepare('DELETE FROM redirects WHERE from_path = ?').bind(originalFrom), ...insertStatements(db, v.from, v.to, note)])
        }
        return NextResponse.json({ ok: true, from: v.from, to: v.to }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects] edit failed', error)
        return fail('Yönlendirme kaydedilemedi.', 500)
    }
}

export async function DELETE(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied
    const from = req.nextUrl.searchParams.get('from')
    if (!from) return fail('Silinecek yönlendirme belirtilmedi.')
    try {
        const { db } = await redirectsAdminContext()
        await db.prepare('DELETE FROM redirects WHERE from_path = ?').bind(from).run()
        return NextResponse.json({ ok: true }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects] delete failed', error)
        return fail('Yönlendirme silinemedi.', 500)
    }
}
