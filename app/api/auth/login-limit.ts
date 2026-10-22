// Failed password logins are limited per account e-mail + client IP (/api/auth/login: customers and the admin
// password step).
//
// Every attempt is recorded in login_failures (schema.sql) BEFORE the password is checked, in one conditional
// INSERT that only adds the row while, within the last LOGIN_WINDOW_MS, that e-mail + IP has fewer than
// MAX_FAILURES_PER_EMAIL_IP rows and the IP fewer than MAX_FAILURES_PER_IP. D1 runs one statement (and one
// batch) at a time, so parallel requests can't get more guesses than that. An attempt that finds no free slot
// is answered 429 without looking at the password. The right password deletes that e-mail + IP's rows (this
// attempt's included), so only failures stay counted, and only for the IP they came from: someone guessing
// from another IP can't lock a customer out. Rows hold SHA-256 hashes keyed with the JWT_SECRET Worker secret,
// never the typed e-mail (people sometimes type their password there) or the IP; expired rows are deleted with
// every attempt. Additive only: older code never reads the table, so rolling back needs nothing.

/** Sliding window of the limit. */
export const LOGIN_WINDOW_MS = 15 * 60 * 1000
/** Failed attempts per account e-mail + IP within the window; the next attempt gets 429. */
export const MAX_FAILURES_PER_EMAIL_IP = 10
/** Failed attempts per IP (any e-mail) within the window. */
export const MAX_FAILURES_PER_IP = 50

export const TOO_MANY_ATTEMPTS = 'Çok fazla deneme. Lütfen 15 dakika sonra tekrar dene.'

// The D1 methods used here (a real D1Database satisfies it)
type Statement = { bind(...values: unknown[]): Statement; run(): Promise<unknown> }
type LimitDB = {
    prepare(sql: string): Statement
    batch(statements: Statement[]): Promise<{ results?: unknown[] }[]>
}

// Same statements as in schema.sql (deploy runs it before every deploy). They also run here once per isolate,
// so the limit works even if that deploy step failed (it is continue-on-error).
const TABLE_SQL = [
    `CREATE TABLE IF NOT EXISTS login_failures (
    id INTEGER PRIMARY KEY,
    email_hash TEXT NOT NULL,
    ip_hash TEXT NOT NULL,
    attempted_at INTEGER NOT NULL
)`,
    'CREATE INDEX IF NOT EXISTS idx_login_failures_email_ip ON login_failures(email_hash, ip_hash, attempted_at)',
    'CREATE INDEX IF NOT EXISTS idx_login_failures_ip ON login_failures(ip_hash, attempted_at)',
    'CREATE INDEX IF NOT EXISTS idx_login_failures_attempted_at ON login_failures(attempted_at)',
]

let tableReady = false

async function ensureTable(db: LimitDB): Promise<void> {
    if (tableReady) return
    await db.batch(TABLE_SQL.map(sql => db.prepare(sql)))
    tableReady = true
}

// Keyed with the Worker secret, so a stored hash can't be matched against a list of e-mails or the IPv4 space
async function keyedHash(value: string): Promise<string> {
    const input = `${process.env.JWT_SECRET || ''}:login-limit:${value}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The client the limits count: the IP Cloudflare puts on every request (CF-Connecting-IP, not settable by
 * the client). An IPv6 subscriber usually holds a whole /64, so IPv6 is counted per /64.
 */
export function clientKey(headers: { get(name: string): string | null }): string {
    const ip = headers.get('cf-connecting-ip')?.trim().toLowerCase() || 'unknown'
    if (!ip.includes(':') || ip.includes('.')) return ip
    const [head, tail] = ip.split('::')
    const left = head ? head.split(':') : []
    const right = tail ? tail.split(':') : []
    const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right]
    return `${groups.slice(0, 4).map(g => g.replace(/^0+(?=.)/, '')).join(':')}::/64`
}

export type LoginAttempt = { allowed: false } | { allowed: true; emailHash: string; ipHash: string }

/**
 * Records this attempt if the limits allow it ({ allowed: true }), otherwise records nothing
 * ({ allowed: false }: answer 429). `email` is the normalised e-mail of the account being signed in to.
 */
export async function reserveLoginAttempt(db: LimitDB, email: string, client: string): Promise<LoginAttempt> {
    await ensureTable(db)
    const [emailHash, ipHash] = await Promise.all([keyedHash(`email:${email}`), keyedHash(`ip:${client}`)])
    const now = Date.now()
    const since = now - LOGIN_WINDOW_MS
    const [, reserved] = await db.batch([
        db.prepare('DELETE FROM login_failures WHERE attempted_at <= ?').bind(since),
        db.prepare(
            'INSERT INTO login_failures (email_hash, ip_hash, attempted_at) SELECT ?1, ?2, ?3 ' +
            'WHERE (SELECT COUNT(*) FROM login_failures WHERE email_hash = ?1 AND ip_hash = ?2 AND attempted_at > ?4) < ?5 ' +
            'AND (SELECT COUNT(*) FROM login_failures WHERE ip_hash = ?2 AND attempted_at > ?4) < ?6 ' +
            'RETURNING id'
        ).bind(emailHash, ipHash, now, since, MAX_FAILURES_PER_EMAIL_IP, MAX_FAILURES_PER_IP),
    ])
    return reserved?.results?.length ? { allowed: true, emailHash, ipHash } : { allowed: false }
}

/** The right password: this e-mail + IP starts from zero again. */
export async function clearLoginFailures(db: LimitDB, attempt: { emailHash: string; ipHash: string }): Promise<void> {
    await db.prepare('DELETE FROM login_failures WHERE email_hash = ? AND ip_hash = ?')
        .bind(attempt.emailHash, attempt.ipHash).run()
}
