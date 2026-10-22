// Admin 2FA challenge, shared by /api/auth/login (issues it) and /api/auth/verify-2fa (redeems it).
//
// Every admin login that sends a code also stores a challenge row (two_factor_challenges, schema.sql) and
// sets its random id as a short-lived HttpOnly cookie. verify-2fa only looks at the code of the challenge in
// that cookie, so:
//   - only the browser that passed the password step can try codes (nobody can cancel the owner's pending
//     code by posting wrong codes for userId 2),
//   - wrong attempts are counted per challenge in ONE conditional UPDATE (attempts < 5), before any code is
//     compared, so parallel requests can't test more than 5 guesses,
//   - the code is marked used with UPDATE ... WHERE used = 0 RETURNING, so it can be redeemed only once.
// The code itself stays in two_factor_codes as before (forgot-password reads its email_sent_to), so rolling
// back to code that doesn't know the challenge table keeps working.
import type { NextResponse } from 'next/server'
import { SESSION_HINT_COOKIE } from '@/lib/session-hint'

/** How long an admin 2FA code (and its challenge cookie) stays valid; the e-mail can take a while to arrive. */
export const TWO_FACTOR_TTL_MS = 5 * 60 * 1000
/** Code attempts per challenge (a new login issues a new code and a new challenge). */
export const MAX_CODE_ATTEMPTS = 5

export const CHALLENGE_COOKIE = 'onopo_2fa'
const CHALLENGE_COOKIE_PATH = '/api/auth/'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days, like the JWT

// Same statement as in schema.sql (deploy runs it before every deploy). Login runs it too, once per isolate,
// so an admin can still log in if that deploy step failed (it is continue-on-error).
const CHALLENGE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS two_factor_challenges (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    code_id INTEGER NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
)`

let challengeTableReady = false

export async function ensureChallengeTable(db: { prepare(sql: string): { run(): Promise<unknown> } }): Promise<void> {
    if (challengeTableReady) return
    await db.prepare(CHALLENGE_TABLE_SQL).run()
    challengeTableReady = true
}

/** 256-bit random challenge id (hex). */
export function newChallengeId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
}

export function isChallengeId(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

/** Constant-time comparison of two short strings (the 6-digit code). */
export function sameCode(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

export function setChallengeCookie(response: NextResponse, id: string): void {
    response.cookies.set(CHALLENGE_COOKIE, id, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: CHALLENGE_COOKIE_PATH,
        maxAge: Math.floor(TWO_FACTOR_TTL_MS / 1000),
    })
}

export function clearChallengeCookie(response: NextResponse): void {
    response.cookies.set(CHALLENGE_COOKIE, '', {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: CHALLENGE_COOKIE_PATH,
        maxAge: 0,
    })
}

/** The login session cookie (unchanged attributes) plus its readable hint (lib/session-hint.ts). */
export function setSessionCookies(response: NextResponse, token: string): void {
    response.cookies.set('auth_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
    })
    response.cookies.set(SESSION_HINT_COOKIE, '1', {
        httpOnly: false,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_MAX_AGE,
    })
}
