/**
 * /api/admin/assistant/conversations/<id>/ (admin only): one stored Onopo Asistan conversation.
 * GET    → { summary: ConversationSummary; messages: TranscriptMessage[] } (404 { error: 'not_found' })
 * DELETE → { ok: true }: removes the conversation and all its messages (e.g. a visitor asked on WhatsApp).
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { getDB } from '@/lib/db'
import { deleteConversation, getConversation, isConversationId } from '@/lib/assistant/transcripts'
import type { D1Lite } from '@/lib/assistant/limits'

export const dynamic = 'force-dynamic'

const headers = { 'Cache-Control': 'private, no-store' }

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied
    const { id } = await params
    if (!isConversationId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
    try {
        const db = await getDB()
        const conv = await getConversation(db as unknown as D1Lite, id)
        if (!conv) return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
        return NextResponse.json(conv, { headers })
    } catch (err) {
        console.error('ai_admin_conversation_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Sohbet alınamadı.' }, { status: 500, headers })
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied
    const { id } = await params
    if (!isConversationId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404, headers })
    try {
        const db = await getDB()
        await deleteConversation(db as unknown as D1Lite, id)
        return NextResponse.json({ ok: true }, { headers })
    } catch (err) {
        console.error('ai_admin_conversation_delete_failed', err instanceof Error ? err.name : 'error')
        return NextResponse.json({ error: 'Sohbet silinemedi.' }, { status: 500, headers })
    }
}
