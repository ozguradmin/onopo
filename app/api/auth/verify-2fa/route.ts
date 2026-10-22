import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'
import { getDB } from '@/lib/db'
import { signJWT } from '@/lib/auth'
import { CHALLENGE_COOKIE, MAX_CODE_ATTEMPTS, clearChallengeCookie, isChallengeId, sameCode, setSessionCookies } from '../two-factor'

// Second step of the admin login. The code is checked only together with the HttpOnly challenge cookie that
// /api/auth/login set for that login (two-factor.ts): attempts are counted per challenge, atomically, before
// the code is compared, and a code can be redeemed once.

const LOGIN_AGAIN = 'Doğrulama oturumu bulunamadı. Lütfen tekrar giriş yapın.'
const TOO_MANY = 'Çok fazla hatalı deneme. Lütfen tekrar giriş yapın.'
const EXPIRED = 'Doğrulama kodunun süresi doldu. Lütfen tekrar giriş yapın.'
const INVALID = 'Geçersiz doğrulama kodu'

function fail(error: string, status: number, endChallenge = false) {
    const response = NextResponse.json({ error }, { status })
    if (endChallenge) clearChallengeCookie(response)
    return response
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const { userId, code } = parsed.body

        if (!userId || !code) {
            return NextResponse.json({ error: 'Kullanıcı ID ve kod zorunludur' }, { status: 400 })
        }

        // Without the cookie of a login there is nothing to check, and nothing is written
        const challengeId = req.cookies.get(CHALLENGE_COOKIE)?.value
        if (!isChallengeId(challengeId)) return fail(LOGIN_AGAIN, 401)

        // Count this attempt first, in one statement: only the first MAX_CODE_ATTEMPTS attempts of a live
        // challenge get a row back, however many requests run in parallel
        const now = new Date().toISOString()
        let attempt: { user_id: number; code_id: number; attempts: number } | null
        try {
            attempt = await db.prepare(
                'UPDATE two_factor_challenges SET attempts = attempts + 1 ' +
                'WHERE id = ? AND attempts < ? AND expires_at > ? RETURNING user_id, code_id, attempts'
            ).bind(challengeId, MAX_CODE_ATTEMPTS, now).first() as any
        } catch (error: any) {
            // The table is created by schema.sql / the first login after a deploy; before that no challenge exists
            if (String(error?.message || error).includes('no such table')) return fail(LOGIN_AGAIN, 401, true)
            throw error
        }

        if (!attempt) {
            const challenge = await db.prepare(
                'SELECT attempts, expires_at FROM two_factor_challenges WHERE id = ?'
            ).bind(challengeId).first() as any
            if (!challenge) return fail(LOGIN_AGAIN, 401, true)
            if (Number(challenge.attempts) >= MAX_CODE_ATTEMPTS) return fail(TOO_MANY, 429, true)
            return fail(EXPIRED, 401, true)
        }

        const record = await db.prepare(
            'SELECT id, code, expires_at FROM two_factor_codes WHERE id = ? AND used = 0'
        ).bind(attempt.code_id).first() as any
        const lastAttempt = Number(attempt.attempts) >= MAX_CODE_ATTEMPTS

        if (!record) return fail(LOGIN_AGAIN, 401, true)
        if (new Date() > new Date(record.expires_at)) {
            await db.prepare('UPDATE two_factor_codes SET used = 1 WHERE id = ?').bind(record.id).run()
            return fail(EXPIRED, 401, true)
        }

        const matches = Number(userId) === Number(attempt.user_id) && sameCode(String(record.code), String(code).trim())
        if (!matches) {
            if (lastAttempt) {
                // The 5th wrong code ends this login: the code can't be used any more
                await db.prepare('UPDATE two_factor_codes SET used = 1 WHERE id = ?').bind(record.id).run()
                return fail(TOO_MANY, 429, true)
            }
            return fail(INVALID, 401)
        }

        // Redeem the code exactly once (a parallel request with the same code gets nothing back)
        const redeemed = await db.prepare(
            'UPDATE two_factor_codes SET used = 1 WHERE id = ? AND used = 0 RETURNING id'
        ).bind(record.id).first()
        if (!redeemed) return fail(INVALID, 401, true)
        await db.prepare('DELETE FROM two_factor_challenges WHERE id = ?').bind(challengeId).run()

        // Get user
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(attempt.user_id).first() as any

        if (!user) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 404 })
        }

        // Generate JWT
        const token = await signJWT({
            id: user.id,
            email: user.email,
            role: user.role,
            fullName: user.full_name
        })

        const response = NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.full_name,
                role: user.role
            }
        })

        setSessionCookies(response, token)
        clearChallengeCookie(response)

        return response

    } catch (error: any) {
        console.error('2FA verify error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
