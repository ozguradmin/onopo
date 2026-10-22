/**
 * System log ("Sistem kayıtları" in the admin): what the automatic jobs could not do.
 *
 * Why: the owner does not press buttons any more. Product facts for the assistant, image variants and the
 * daily cron run by themselves, so a failure would otherwise only reach the Worker logs, which nobody reads.
 * Every job reports here instead, and /admin/kayitlar/ lists it with a badge for unresolved errors.
 *
 * Rules:
 *  - logSystemEvent never throws: a broken log must never break the job that reports.
 *  - De-duplication: the same source + message + ref within 24 hours is ONE row whose `count` grows and whose
 *    `last_at` moves. A daily job that fails the same way every day therefore stays one line per day, not
 *    hundreds. An entry the owner marked "Çözüldü" comes back (resolved_at cleared) if it happens again.
 *  - Rows whose last occurrence is older than 90 days are deleted lazily (at most every 6 hours per isolate).
 *  - No customer data: messages are fixed Turkish sentences, `ref` is a product id or an image key, `detail`
 *    a short technical reason (error codes, counts).
 *
 * Pure apart from the injected database (tests pass a node:sqlite fake), so worker.ts can import it too.
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

export interface SystemLogRow {
    id: number
    created_at: string
    source: SystemLogSource
    level: SystemLogLevel
    message: string
    detail: string | null
    ref: string | null
    count: number
    last_at: string
    resolved_at: string | null
}

/** The few D1 methods used here (a real D1Database satisfies it). */
export interface SystemLogDb {
    prepare(sql: string): SystemLogStmt
}
interface SystemLogStmt {
    bind(...values: unknown[]): SystemLogStmt
    first<T = Record<string, unknown>>(): Promise<T | null>
    all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>
    run(): Promise<unknown>
}

export const SYSTEM_LOG_SOURCES: readonly SystemLogSource[] = ['facts', 'images', 'cron', 'assistant', 'redirects', 'other']
export const SYSTEM_LOG_LEVELS: readonly SystemLogLevel[] = ['error', 'warn', 'info']

/** Same window for de-duplication everywhere (24 h). */
export const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000
/** Rows whose last occurrence is older than this are deleted. */
export const RETENTION_MS = 90 * 24 * 60 * 60 * 1000
const PRUNE_EVERY_MS = 6 * 60 * 60 * 1000

const MESSAGE_MAX = 300
const DETAIL_MAX = 2000
const REF_MAX = 200

/** Same statements as schema.sql, so a database created before this feature works too. */
export const SYSTEM_LOG_TABLE_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    source TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    detail TEXT,
    ref TEXT,
    count INTEGER NOT NULL DEFAULT 1,
    last_at TEXT NOT NULL,
    resolved_at TEXT
)`,
    'CREATE INDEX IF NOT EXISTS idx_system_logs_last ON system_logs(last_at)',
    'CREATE INDEX IF NOT EXISTS idx_system_logs_key ON system_logs(source, message, last_at)',
]

let tableReady: Promise<void> | null = null
let lastPruneAt = 0

/** CREATE TABLE IF NOT EXISTS once per isolate (a failure is retried on the next call). */
export function ensureSystemLogTable(db: SystemLogDb): Promise<void> {
    if (!tableReady) {
        tableReady = (async () => {
            for (const sql of SYSTEM_LOG_TABLE_STATEMENTS) await db.prepare(sql).run()
        })().catch(err => {
            tableReady = null
            throw err
        })
    }
    return tableReady
}

/** Tests: forget the per-isolate memos. */
export function resetSystemLogMemo(): void {
    tableReady = null
    lastPruneAt = 0
}

function clip(value: string | null | undefined, max: number): string | null {
    if (value == null) return null
    const one = String(value).replace(/\s+/g, ' ').trim()
    if (!one) return null
    return one.length > max ? `${one.slice(0, max - 1)}…` : one
}

function isSource(v: unknown): v is SystemLogSource {
    return typeof v === 'string' && (SYSTEM_LOG_SOURCES as readonly string[]).includes(v)
}
function isLevel(v: unknown): v is SystemLogLevel {
    return typeof v === 'string' && (SYSTEM_LOG_LEVELS as readonly string[]).includes(v)
}

/** Deletes rows whose last occurrence is older than 90 days. Never throws. */
export async function pruneSystemLogs(db: SystemLogDb, now: Date = new Date()): Promise<void> {
    try {
        await ensureSystemLogTable(db)
        await db.prepare('DELETE FROM system_logs WHERE last_at < ?').bind(new Date(now.getTime() - RETENTION_MS).toISOString()).run()
        lastPruneAt = now.getTime()
    } catch (err) {
        console.error('system_log_prune_failed', err instanceof Error ? err.message : 'error')
    }
}

/**
 * Records one event (see the file comment for the de-duplication rule). Never throws.
 * `now` is for tests.
 */
export async function logSystemEvent(db: SystemLogDb | null | undefined, e: SystemLogEvent, now: Date = new Date()): Promise<void> {
    try {
        if (!db) return
        const source: SystemLogSource = isSource(e?.source) ? e.source : 'other'
        const level: SystemLogLevel = isLevel(e?.level) ? e.level : 'error'
        const message = clip(e?.message, MESSAGE_MAX)
        if (!message) return
        const detail = clip(e.detail ?? null, DETAIL_MAX)
        const ref = clip(e.ref ?? null, REF_MAX)
        const at = now.toISOString()
        // Also in the Worker logs (Cloudflare dashboard), without the detail
        const line = `system_log ${source} ${level}: ${message}${ref ? ` [${ref}]` : ''}`
        if (level === 'error') console.error(line)
        else console.log(line)

        await ensureSystemLogTable(db)
        const since = new Date(now.getTime() - DEDUP_WINDOW_MS).toISOString()
        // `ref IS ?` matches NULL with NULL (an event without a ref de-duplicates with itself)
        const existing = await db
            .prepare('SELECT id FROM system_logs WHERE source = ? AND message = ? AND ref IS ? AND last_at >= ? ORDER BY id DESC LIMIT 1')
            .bind(source, message, ref, since)
            .first<{ id: number }>()
        if (existing?.id != null) {
            await db
                .prepare('UPDATE system_logs SET count = count + 1, last_at = ?, level = ?, detail = COALESCE(?, detail), resolved_at = NULL WHERE id = ?')
                .bind(at, level, detail, existing.id)
                .run()
        } else {
            await db
                .prepare('INSERT INTO system_logs (created_at, source, level, message, detail, ref, count, last_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)')
                .bind(at, source, level, message, detail, ref, at)
                .run()
        }
        if (now.getTime() - lastPruneAt > PRUNE_EVERY_MS) await pruneSystemLogs(db, now)
    } catch (err) {
        console.error('system_log_failed', err instanceof Error ? err.message : 'error')
    }
}

export interface ListOptions {
    source?: string | null
    level?: string | null
    /** include entries marked "Çözüldü" */
    includeResolved?: boolean
    limit?: number
}

/** Newest occurrence first. Unknown filter values are ignored. */
export async function listSystemLogs(db: SystemLogDb, opts: ListOptions = {}): Promise<SystemLogRow[]> {
    await ensureSystemLogTable(db)
    const where: string[] = []
    const binds: unknown[] = []
    if (isSource(opts.source)) {
        where.push('source = ?')
        binds.push(opts.source)
    }
    if (isLevel(opts.level)) {
        where.push('level = ?')
        binds.push(opts.level)
    }
    if (!opts.includeResolved) where.push('resolved_at IS NULL')
    const limit = Math.max(1, Math.min(500, Math.trunc(opts.limit ?? 200)))
    const sql = `SELECT id, created_at, source, level, message, detail, ref, count, last_at, resolved_at FROM system_logs${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY last_at DESC, id DESC LIMIT ${limit}`
    const stmt = db.prepare(sql)
    const { results } = await (binds.length ? stmt.bind(...binds) : stmt).all<SystemLogRow>()
    return (results ?? []).map(r => ({ ...r, id: Number(r.id), count: Number(r.count) || 1 }))
}

/** Unresolved rows per level (the sidebar badge shows `error`). */
export async function countUnresolved(db: SystemLogDb): Promise<Record<SystemLogLevel, number>> {
    await ensureSystemLogTable(db)
    const { results } = await db
        .prepare('SELECT level, COUNT(*) AS n FROM system_logs WHERE resolved_at IS NULL GROUP BY level')
        .all<{ level: string; n: number }>()
    const out: Record<SystemLogLevel, number> = { error: 0, warn: 0, info: 0 }
    for (const r of results ?? []) if (isLevel(r.level)) out[r.level] = Number(r.n) || 0
    return out
}

/** "Çözüldü": hides the entry until it happens again. true when a row was found. */
export async function resolveSystemLog(db: SystemLogDb, id: number, now: Date = new Date()): Promise<boolean> {
    await ensureSystemLogTable(db)
    const row = await db.prepare('SELECT id FROM system_logs WHERE id = ?').bind(Math.trunc(id)).first<{ id: number }>()
    if (!row) return false
    await db.prepare('UPDATE system_logs SET resolved_at = ? WHERE id = ?').bind(now.toISOString(), Math.trunc(id)).run()
    return true
}

/** "Hepsini çözüldü say" for one source or for everything. Returns nothing; never touches resolved rows. */
export async function resolveAllSystemLogs(db: SystemLogDb, source: string | null, now: Date = new Date()): Promise<void> {
    await ensureSystemLogTable(db)
    if (isSource(source)) {
        await db.prepare('UPDATE system_logs SET resolved_at = ? WHERE resolved_at IS NULL AND source = ?').bind(now.toISOString(), source).run()
    } else {
        await db.prepare('UPDATE system_logs SET resolved_at = ? WHERE resolved_at IS NULL').bind(now.toISOString()).run()
    }
}
