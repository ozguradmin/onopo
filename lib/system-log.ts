/**
 * System log: unusual failures the owner may need to see (a redirect target that disappeared, an index that
 * could not be loaded, a failed cron step …), written to the D1 table system_logs.
 *
 * Minimal version from the redirects package (w9-yonlendirme). The images/assistant package ships the full
 * version with the same signature and the same table; that one wins at merge.
 *
 * - De-duplicated: the same source + message + ref within 24 h only increments `count` and moves `last_at`,
 *   so a failure repeated on every request is one row, not thousands.
 * - Never throws: logging must not turn a handled failure into a broken request.
 * - Rows older than 90 days are pruned lazily (at most once per isolate per hour).
 */

export type SystemLogSource = 'redirects' | 'facts' | 'images' | 'cron' | 'assistant' | 'other'
export type SystemLogLevel = 'error' | 'warn' | 'info'

export interface SystemLogEvent {
    source: SystemLogSource
    level: SystemLogLevel
    message: string
    detail?: string | null
    ref?: string | null
}

interface D1StmtLike {
    bind(...values: unknown[]): D1StmtLike
    run(): Promise<unknown>
    first<T = Record<string, unknown>>(): Promise<T | null>
}
interface D1DatabaseLike {
    prepare(sql: string): D1StmtLike
}

const KEEP_DAYS = 90
const PRUNE_EVERY_MS = 3600_000

export const SYSTEM_LOGS_TABLE = `CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    source TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    ref TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    last_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`
const SYSTEM_LOGS_INDEX = 'CREATE INDEX IF NOT EXISTS idx_system_logs_dedup ON system_logs(source, message, ref, last_at)'

let tableReady = false
let lastPrune = 0

function clip(value: string | null | undefined, max: number): string | null {
    if (value == null) return null
    const s = String(value)
    return s.length > max ? `${s.slice(0, max - 1)}…` : s
}

export async function logSystemEvent(db: D1DatabaseLike | null | undefined, e: SystemLogEvent): Promise<void> {
    if (!db) return
    try {
        if (!tableReady) {
            await db.prepare(SYSTEM_LOGS_TABLE).run()
            await db.prepare(SYSTEM_LOGS_INDEX).run()
            tableReady = true
        }
        const message = clip(e.message, 300) ?? ''
        const ref = clip(e.ref ?? null, 300)
        const detail = clip(e.detail ?? null, 2000)
        const existing = await db
            .prepare(
                `SELECT id FROM system_logs
                 WHERE source = ? AND message = ? AND COALESCE(ref, '') = COALESCE(?, '')
                   AND last_at >= datetime('now', '-1 day')
                 ORDER BY id DESC LIMIT 1`,
            )
            .bind(e.source, message, ref)
            .first<{ id: number }>()
        if (existing) {
            await db
                .prepare('UPDATE system_logs SET count = count + 1, last_at = CURRENT_TIMESTAMP, detail = COALESCE(?, detail), level = ? WHERE id = ?')
                .bind(detail, e.level, existing.id)
                .run()
        } else {
            await db
                .prepare('INSERT INTO system_logs (source, level, message, detail, ref) VALUES (?, ?, ?, ?, ?)')
                .bind(e.source, e.level, message, detail, ref)
                .run()
        }
        const now = Date.now()
        if (now - lastPrune > PRUNE_EVERY_MS) {
            lastPrune = now
            await db.prepare(`DELETE FROM system_logs WHERE last_at < datetime('now', '-${KEEP_DAYS} days')`).run()
        }
    } catch (error) {
        console.error('[system-log] write failed', error)
    }
}
