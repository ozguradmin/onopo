/**
 * GET /api/admin/assistant/conversations/export/?format=csv|json&from=YYYY-MM-DD&to=YYYY-MM-DD (admin only)
 * → a file download of the stored Onopo Asistan conversations in the date range (default: everything kept,
 * up to 365 days; at most 50,000 messages). CSV: one row per message (conversation, Istanbul time, turn,
 * who, text, products shown with ids and names, WhatsApp reason), UTF-8 with BOM and ";" so Turkish Excel
 * opens it directly. JSON: one object per conversation with its messages and cards.
 */
import { requireAdmin } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { exportRows, parseListParams, toCsv, toJsonExport } from '@/lib/assistant/transcripts'
import type { D1Lite } from '@/lib/assistant/limits'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied
    const sp = new URL(req.url).searchParams
    const format = sp.get('format') === 'json' ? 'json' : 'csv'
    const { from, to } = parseListParams(sp)
    try {
        const db = await getDB()
        const rows = await exportRows(db as unknown as D1Lite, { from, to })
        const name = `onopo-asistan-sohbetler-${from}_${to}.${format}`
        const body = format === 'json' ? JSON.stringify({ from, to, conversations: toJsonExport(rows) }, null, 2) : toCsv(rows)
        return new Response(body, {
            headers: {
                'Content-Type': format === 'json' ? 'application/json; charset=utf-8' : 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${name}"`,
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
            },
        })
    } catch (err) {
        console.error('ai_admin_export_failed', err instanceof Error ? err.name : 'error')
        return Response.json({ error: 'Dışa aktarma yapılamadı.' }, { status: 500, headers: { 'Cache-Control': 'private, no-store' } })
    }
}
