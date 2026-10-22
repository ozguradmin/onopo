/**
 * Onopo Asistan: chat transcripts for review and analysis (pure apart from the injected D1).
 *
 * Owner decision (w7, replaces KVKK option A "store nothing"): conversations are kept so the shop can see
 * what people ask and improve the site and the assistant. What is stored is exactly what the model and the
 * visitor saw, never more:
 *  - the user text MASKED (maskPII after sanitize: what the model got), never the raw input;
 *  - the final validated assistant text and its card events (products, compare, links, store_info,
 *    whatsapp, suggestions); the WhatsApp card is stored without its wa.me base, so no number is kept;
 *  - outcome, model, timing, the page type and the phone model pill (both already masked by the request
 *    parser). No IP, user agent, cookie or reasoning.
 * The conversation id is the same 16-hex sha256 of the client's random conversation id that
 * ai_chat_events uses (conv_hash), so a transcript and its usage rows can be joined; the client id itself
 * is not stored. Rows are kept for 365 days (pruned lazily, 1 write in 50), and the admin can delete a
 * conversation at any time (the notice tells visitors they can ask for that on WhatsApp).
 */
import type { AssistantEvent, PageContext } from './contract'
import { HANDOFF_LABELS } from './contract'
import { istanbulDay, istanbulParts } from './facts'
import type { D1Lite } from './limits'

// ---------------------------------------------------------------------------------------------
// Shared HTTP contract types (/api/admin/assistant/conversations/*)
// ---------------------------------------------------------------------------------------------

export type TranscriptOutcome = 'ok' | 'error' | 'busy' | 'mixed'

export interface ConversationSummary {
    id: string
    startedAt: string
    lastAt: string
    turns: number
    firstMessage: string
    device: string | null
    page: string | null
    /** A full WhatsApp card (a hand-off) was shown in some turn. The compact row under every answer does not count. */
    waShown: boolean
    productIds: number[]
    outcome: TranscriptOutcome
}

export type TranscriptEvent = Extract<AssistantEvent, { t: 'products' | 'compare' | 'links' | 'store_info' | 'whatsapp' | 'suggestions' }>

export interface TranscriptMessage {
    role: 'user' | 'assistant'
    text: string
    /** assistant only: the cards of that turn, in the order they were sent */
    events: TranscriptEvent[]
    at: string
}

export const TRANSCRIPT_RETENTION_DAYS = 365
export const PAGE_SIZE = 30
const CARD_TYPES: ReadonlySet<string> = new Set(['products', 'compare', 'links', 'store_info', 'whatsapp', 'suggestions'])

// ---------------------------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------------------------

/** Same statements as schema.sql (the deploy runs it); this copy covers requests that come first. */
export const TRANSCRIPT_TABLE_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    day TEXT NOT NULL,
    started_at TEXT NOT NULL,
    last_at TEXT NOT NULL,
    turns INTEGER NOT NULL DEFAULT 0,
    first_message TEXT,
    device TEXT,
    page TEXT,
    wa_shown INTEGER NOT NULL DEFAULT 0,
    product_ids TEXT,
    n_ok INTEGER NOT NULL DEFAULT 0,
    n_error INTEGER NOT NULL DEFAULT 0,
    n_busy INTEGER NOT NULL DEFAULT 0
)`,
    'CREATE INDEX IF NOT EXISTS idx_ai_conversations_last ON ai_conversations(last_at)',
    'CREATE INDEX IF NOT EXISTS idx_ai_conversations_day ON ai_conversations(day)',
    `CREATE TABLE IF NOT EXISTS ai_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conv_id TEXT NOT NULL,
    turn INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    events TEXT,
    outcome TEXT,
    model TEXT,
    total_ms INTEGER,
    created_at TEXT NOT NULL
)`,
    'CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_messages(conv_id, id)',
    'CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at)',
]

let tablesReady: Promise<void> | null = null

export function ensureTranscriptTables(db: D1Lite): Promise<void> {
    if (!tablesReady) {
        tablesReady = (async () => {
            for (const sql of TRANSCRIPT_TABLE_STATEMENTS) await db.prepare(sql).run()
        })().catch(err => {
            tablesReady = null
            throw err
        })
    }
    return tablesReady
}

export function resetTranscriptMemo(): void {
    tablesReady = null
}

// ---------------------------------------------------------------------------------------------
// Collecting one turn from the event stream
// ---------------------------------------------------------------------------------------------

/** A card event as stored: the WhatsApp card loses its wa.me base (the store's number). */
export function storableEvent(ev: AssistantEvent): TranscriptEvent | null {
    if (!CARD_TYPES.has(ev.t)) return null
    if (ev.t === 'whatsapp') return { ...ev, waBase: '' }
    return ev as TranscriptEvent
}

export interface TurnCapture {
    text: string
    events: TranscriptEvent[]
    device: string | null
    productIds: number[]
    /** a full WhatsApp card was sent */
    waFull: boolean
}

/** Wraps the route's emit: everything the visitor got in this turn, ready to store. */
export function createTurnCapture(): { onEvent(ev: AssistantEvent): void; result(): TurnCapture } {
    let text = ''
    const events: TranscriptEvent[] = []
    let device: string | null = null
    const productIds: number[] = []
    let waFull = false
    return {
        onEvent(ev) {
            if (ev.t === 'text') text += ev.v
            else if (ev.t === 'device') device = ev.v
            else {
                const s = storableEvent(ev)
                if (!s) return
                events.push(s)
                if (s.t === 'products' || s.t === 'compare') for (const p of s.products) if (!productIds.includes(p.id)) productIds.push(p.id)
                if (s.t === 'whatsapp' && s.variant === 'full') waFull = true
            }
        },
        result: () => ({ text: text.trim(), events, device, productIds, waFull }),
    }
}

/** Short page label for the summary ("ürün: /slug/", "arama: kablo"); the listing query is already masked. */
export function pageLabel(page: PageContext): string {
    switch (page.type) {
        case 'home': return 'anasayfa'
        case 'product': return `ürün: /${page.slug}/`
        case 'category': return `kategori: ${page.slug}`
        case 'listing': return page.query ? `arama: ${page.query}` : 'ürün listesi'
        case 'page': return `sayfa: ${page.slug}`
        default: return 'diğer'
    }
}

/** TurnOutcome → the three buckets of a summary. A visitor's own stop counts as ok. */
export function outcomeBucket(outcome: string): 'ok' | 'error' | 'busy' {
    if (outcome === 'busy') return 'busy'
    if (outcome === 'error' || outcome === 'timeout') return 'error'
    return 'ok'
}

// ---------------------------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------------------------

export interface TranscriptTurn {
    /** sha16(conversationId) */
    convId: string
    turn: number
    /** maskPII(sanitize(input)): what the model saw */
    userText: string
    capture: TurnCapture
    /** TurnLog.outcome */
    outcome: string
    model: string | null
    totalMs: number
    page: string | null
    /** the device pill (request, masked) unless the turn detected one */
    device: string | null
}

const MAX_TEXT = 4000
const MAX_EVENTS_JSON = 60_000

/** Stores one turn (two messages + the conversation row). Never throws; old rows go 1 time in 50. */
export async function recordTranscript(db: D1Lite, t: TranscriptTurn, now: Date = new Date(), random: () => number = Math.random): Promise<void> {
    try {
        await ensureTranscriptTables(db)
        const at = now.toISOString()
        const bucket = outcomeBucket(t.outcome)
        let events = JSON.stringify(t.capture.events)
        if (events.length > MAX_EVENTS_JSON) events = JSON.stringify(t.capture.events.filter(e => e.t !== 'compare' && e.t !== 'products'))
        const products = t.capture.productIds.length ? t.capture.productIds.join(',') : null
        const device = (t.capture.device ?? t.device)?.slice(0, 60) || null
        const conv = db
            .prepare(`INSERT INTO ai_conversations (id, day, started_at, last_at, turns, first_message, device, page, wa_shown, product_ids, n_ok, n_error, n_busy)
VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET last_at = excluded.last_at, turns = turns + 1,
    device = COALESCE(excluded.device, device), page = COALESCE(page, excluded.page),
    wa_shown = MAX(wa_shown, excluded.wa_shown),
    product_ids = CASE WHEN excluded.product_ids IS NULL THEN product_ids WHEN product_ids IS NULL THEN excluded.product_ids
        ELSE substr(product_ids || ',' || excluded.product_ids, 1, 600) END,
    n_ok = n_ok + excluded.n_ok, n_error = n_error + excluded.n_error, n_busy = n_busy + excluded.n_busy`)
            .bind(
                t.convId, istanbulDay(now), at, at, t.userText.slice(0, 300), device, t.page?.slice(0, 160) ?? null,
                t.capture.waFull ? 1 : 0, products, bucket === 'ok' ? 1 : 0, bucket === 'error' ? 1 : 0, bucket === 'busy' ? 1 : 0,
            )
        const insert = 'INSERT INTO ai_messages (conv_id, turn, role, text, events, outcome, model, total_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        const user = db.prepare(insert).bind(t.convId, t.turn, 'user', t.userText.slice(0, MAX_TEXT), null, null, null, null, at)
        const assistant = db.prepare(insert).bind(t.convId, t.turn, 'assistant', t.capture.text.slice(0, MAX_TEXT), events, t.outcome, t.model, Math.round(t.totalMs), at)
        if (db.batch) await db.batch([conv, user, assistant])
        else {
            await conv.run()
            await user.run()
            await assistant.run()
        }
        if (random() < 1 / 50) await pruneTranscripts(db, now)
    } catch (err) {
        console.error('ai_transcript_failed', err instanceof Error ? err.name : 'error')
    }
}

export async function pruneTranscripts(db: D1Lite, now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - TRANSCRIPT_RETENTION_DAYS * 86_400_000).toISOString()
    await db.prepare('DELETE FROM ai_messages WHERE created_at < ?').bind(cutoff).run()
    await db.prepare('DELETE FROM ai_conversations WHERE last_at < ?').bind(cutoff).run()
}

// ---------------------------------------------------------------------------------------------
// Reading (admin)
// ---------------------------------------------------------------------------------------------

export interface ConversationRow {
    id: string
    started_at: string
    last_at: string
    turns: number
    first_message: string | null
    device: string | null
    page: string | null
    wa_shown: number
    product_ids: string | null
    n_ok: number
    n_error: number
    n_busy: number
}

export function toSummary(r: ConversationRow): ConversationSummary {
    const ok = Number(r.n_ok) || 0
    const error = Number(r.n_error) || 0
    const busy = Number(r.n_busy) || 0
    const outcome: TranscriptOutcome = error === 0 && busy === 0 ? 'ok' : ok === 0 && busy === 0 ? 'error' : ok === 0 && error === 0 ? 'busy' : 'mixed'
    const ids: number[] = []
    for (const s of String(r.product_ids ?? '').split(',')) {
        const n = Number(s)
        if (Number.isInteger(n) && n > 0 && !ids.includes(n)) ids.push(n)
    }
    return {
        id: String(r.id),
        startedAt: String(r.started_at),
        lastAt: String(r.last_at),
        turns: Number(r.turns) || 0,
        firstMessage: String(r.first_message ?? ''),
        device: r.device || null,
        page: r.page || null,
        waShown: Number(r.wa_shown) === 1,
        productIds: ids,
        outcome,
    }
}

export function toMessage(r: { role: string; text: string | null; events: string | null; created_at: string }): TranscriptMessage {
    let events: TranscriptEvent[] = []
    if (r.role === 'assistant' && r.events) {
        try {
            const parsed = JSON.parse(r.events)
            if (Array.isArray(parsed)) events = parsed.filter(e => e && CARD_TYPES.has(e.t))
        } catch {
            // a damaged row shows its text only
        }
    }
    return { role: r.role === 'assistant' ? 'assistant' : 'user', text: String(r.text ?? ''), events, at: String(r.created_at) }
}

export interface ListParams {
    from: string
    to: string
    q: string
    page: number
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/

/** Query string → validated params. Defaults: the whole retention window, newest first, page 1. */
export function parseListParams(sp: URLSearchParams, now: Date = new Date()): ListParams {
    const day = (v: string | null, fallback: string) => (v && DAY_RE.test(v) ? v : fallback)
    let from = day(sp.get('from'), istanbulDay(now, TRANSCRIPT_RETENTION_DAYS))
    let to = day(sp.get('to'), istanbulDay(now))
    if (from > to) [from, to] = [to, from]
    const page = Math.max(1, Math.min(10_000, Math.trunc(Number(sp.get('page')) || 1)))
    const q = (sp.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, 100)
    return { from, to, q, page }
}

/** WHERE clause and its arguments for a list or an export (q: a LIKE on any message text). */
export function whereFor(p: Pick<ListParams, 'from' | 'to' | 'q'>): { where: string; args: unknown[] } {
    const args: unknown[] = [p.from, p.to]
    let where = 'c.day >= ? AND c.day <= ?'
    if (p.q) {
        const like = `%${p.q.replace(/[\\%_]/g, m => `\\${m}`)}%`
        where += " AND EXISTS (SELECT 1 FROM ai_messages m WHERE m.conv_id = c.id AND m.text LIKE ? ESCAPE '\\')"
        args.push(like)
    }
    return { where, args }
}

const SUMMARY_COLUMNS = 'c.id, c.started_at, c.last_at, c.turns, c.first_message, c.device, c.page, c.wa_shown, c.product_ids, c.n_ok, c.n_error, c.n_busy'

export async function listConversations(db: D1Lite, p: ListParams): Promise<{ rows: ConversationSummary[]; total: number; page: number; pageSize: number }> {
    await ensureTranscriptTables(db)
    const { where, args } = whereFor(p)
    const count = await db.prepare(`SELECT COUNT(*) AS n FROM ai_conversations c WHERE ${where}`).bind(...args).first<{ n: number }>()
    const { results } = await db
        .prepare(`SELECT ${SUMMARY_COLUMNS} FROM ai_conversations c WHERE ${where} ORDER BY c.last_at DESC LIMIT ? OFFSET ?`)
        .bind(...args, PAGE_SIZE, (p.page - 1) * PAGE_SIZE)
        .all<ConversationRow>()
    return { rows: (results ?? []).map(toSummary), total: Number(count?.n) || 0, page: p.page, pageSize: PAGE_SIZE }
}

export function isConversationId(id: string): boolean {
    return /^[0-9a-f]{16}$/.test(id)
}

export async function getConversation(db: D1Lite, id: string): Promise<{ summary: ConversationSummary; messages: TranscriptMessage[] } | null> {
    if (!isConversationId(id)) return null
    await ensureTranscriptTables(db)
    const row = await db.prepare(`SELECT ${SUMMARY_COLUMNS} FROM ai_conversations c WHERE c.id = ?`).bind(id).first<ConversationRow>()
    if (!row) return null
    const { results } = await db
        .prepare('SELECT role, text, events, created_at FROM ai_messages WHERE conv_id = ? ORDER BY id')
        .bind(id)
        .all<{ role: string; text: string; events: string | null; created_at: string }>()
    return { summary: toSummary(row), messages: (results ?? []).map(toMessage) }
}

export async function deleteConversation(db: D1Lite, id: string): Promise<boolean> {
    if (!isConversationId(id)) return false
    await ensureTranscriptTables(db)
    const a = db.prepare('DELETE FROM ai_messages WHERE conv_id = ?').bind(id)
    const b = db.prepare('DELETE FROM ai_conversations WHERE id = ?').bind(id)
    if (db.batch) await db.batch([a, b])
    else {
        await a.run()
        await b.run()
    }
    return true
}

// ---------------------------------------------------------------------------------------------
// Counts for /admin/assistant
// ---------------------------------------------------------------------------------------------

export interface ConversationCounts {
    today: number
    last7: number
    last30: number
    /** all stored conversations (up to 365 days) */
    total: number
    /** user messages in the last 30 days */
    messages30: number
}

export async function conversationCounts(db: D1Lite, now: Date = new Date()): Promise<ConversationCounts> {
    await ensureTranscriptTables(db)
    const row = await db
        .prepare(`SELECT
    SUM(CASE WHEN day >= ? THEN 1 ELSE 0 END) AS today,
    SUM(CASE WHEN day >= ? THEN 1 ELSE 0 END) AS last7,
    SUM(CASE WHEN day >= ? THEN 1 ELSE 0 END) AS last30,
    COUNT(*) AS total
FROM ai_conversations`)
        .bind(istanbulDay(now), istanbulDay(now, 6), istanbulDay(now, 29))
        .first<{ today: number; last7: number; last30: number; total: number }>()
    const msgs = await db
        .prepare("SELECT COUNT(*) AS n FROM ai_messages WHERE role = 'user' AND created_at >= ?")
        .bind(new Date(now.getTime() - 30 * 86_400_000).toISOString())
        .first<{ n: number }>()
    return {
        today: Number(row?.today) || 0,
        last7: Number(row?.last7) || 0,
        last30: Number(row?.last30) || 0,
        total: Number(row?.total) || 0,
        messages30: Number(msgs?.n) || 0,
    }
}

// ---------------------------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------------------------

export const EXPORT_MAX_MESSAGES = 50_000

export interface ExportRow {
    conv_id: string
    created_at: string
    turn: number
    role: string
    text: string | null
    events: string | null
    /** conversation fields, repeated on each row */
    device?: string | null
    page?: string | null
}

export async function exportRows(db: D1Lite, p: Pick<ListParams, 'from' | 'to'>): Promise<ExportRow[]> {
    await ensureTranscriptTables(db)
    const { where, args } = whereFor({ ...p, q: '' })
    const { results } = await db
        .prepare(`SELECT m.conv_id, m.created_at, m.turn, m.role, m.text, m.events, c.device, c.page FROM ai_messages m JOIN ai_conversations c ON c.id = m.conv_id
WHERE ${where} ORDER BY c.started_at, m.conv_id, m.id LIMIT ?`)
        .bind(...args, EXPORT_MAX_MESSAGES)
        .all<ExportRow>()
    return results ?? []
}

/** "2026-10-22 14:05" in Istanbul time. */
export function istanbulTime(iso: string): string {
    const d = new Date(iso)
    if (!Number.isFinite(d.getTime())) return iso
    const p = istanbulParts(d)
    return `${p.date} ${p.time}`
}

/** Products and WhatsApp reason of one stored assistant message, as export cells. */
export function exportCells(eventsJson: string | null): { products: string; whatsapp: string } {
    const m = toMessage({ role: 'assistant', text: '', events: eventsJson, created_at: '' })
    const seen = new Set<number>()
    const products: string[] = []
    let whatsapp = ''
    for (const e of m.events) {
        if (e.t === 'products' || e.t === 'compare') {
            for (const p of e.products) {
                if (seen.has(p.id)) continue
                seen.add(p.id)
                products.push(`${p.id} ${p.name}`)
            }
        } else if (e.t === 'whatsapp' && !whatsapp) {
            whatsapp = `${HANDOFF_LABELS[e.reason] ?? e.reason} (${e.variant === 'full' ? 'kart' : 'satır'})`
        }
    }
    return { products: products.join(' | '), whatsapp }
}

/** One CSV cell: quoted when needed; a leading = + - @ is defused so Excel never runs it as a formula. */
export function csvCell(v: unknown): string {
    let s = v == null ? '' : String(v)
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
    return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * CSV for Excel in Turkish: UTF-8 with a BOM (so ç, ğ, ı, ö, ş, ü show), ";" between cells (the list
 * separator of Turkish Excel), CRLF line ends. One row per message.
 */
export function toCsv(rows: readonly ExportRow[]): string {
    const head = ['Sohbet', 'Zaman', 'Tur', 'Kim', 'Mesaj', 'Gösterilen ürünler', 'WhatsApp']
    const lines = [head.map(csvCell).join(';')]
    for (const r of rows) {
        const cells = r.role === 'assistant' ? exportCells(r.events) : { products: '', whatsapp: '' }
        lines.push([
            r.conv_id, istanbulTime(r.created_at), r.turn, r.role === 'assistant' ? 'Asistan' : 'Müşteri',
            (r.text ?? '').replace(/\r?\n/g, ' '), cells.products, cells.whatsapp,
        ].map(csvCell).join(';'))
    }
    return `﻿${lines.join('\r\n')}\r\n`
}

/** JSON export: one object per conversation with its messages (the same shapes as the detail route). */
export interface JsonExportConversation {
    id: string
    device: string | null
    page: string | null
    messages: (TranscriptMessage & { turn: number })[]
}

export function toJsonExport(rows: readonly ExportRow[]): JsonExportConversation[] {
    const out: JsonExportConversation[] = []
    let current: (typeof out)[number] | null = null
    for (const r of rows) {
        if (!current || current.id !== r.conv_id) {
            current = { id: r.conv_id, device: r.device ?? null, page: r.page ?? null, messages: [] }
            out.push(current)
        }
        current.messages.push({ ...toMessage({ role: r.role, text: r.text, events: r.events, created_at: r.created_at }), turn: Number(r.turn) || 0 })
    }
    return out
}
