import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { signJWT } from '@/lib/auth'

// Wrong codes allowed per login before the pending code is cancelled (a new login sends a new code)
const MAX_FAILED_ATTEMPTS = 5
// Failed attempts are recorded as used rows with this marker code (no schema change needed);
// /api/auth/login deletes them together with the old codes when it sends a new code.
const FAILED_MARKER = 'FAILED'

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { userId, code } = await req.json()

        if (!userId || !code) {
            return NextResponse.json({ error: 'Kullanıcı ID ve kod zorunludur' }, { status: 400 })
        }

        // Find the 2FA code
        const twoFactorRecord = await db.prepare(
            'SELECT * FROM two_factor_codes WHERE user_id = ? AND code = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
        ).bind(userId, code).first() as any

        if (!twoFactorRecord) {
            // Count wrong codes against the pending code, so the 5-minute window can't be used to guess
            // the 6-digit code. Nothing is written when the user has no pending code.
            const pending = await db.prepare(
                'SELECT id FROM two_factor_codes WHERE user_id = ? AND used = 0 LIMIT 1'
            ).bind(userId).first()
            if (pending) {
                await db.prepare(
                    'INSERT INTO two_factor_codes (user_id, code, email_sent_to, expires_at, used) VALUES (?, ?, ?, ?, 1)'
                ).bind(userId, FAILED_MARKER, '', new Date().toISOString()).run()
                const failed = await db.prepare(
                    'SELECT COUNT(*) AS n FROM two_factor_codes WHERE user_id = ? AND code = ?'
                ).bind(userId, FAILED_MARKER).first() as any
                if (Number(failed?.n) >= MAX_FAILED_ATTEMPTS) {
                    await db.prepare('UPDATE two_factor_codes SET used = 1 WHERE user_id = ? AND used = 0').bind(userId).run()
                    return NextResponse.json({ error: 'Çok fazla hatalı deneme. Lütfen tekrar giriş yapın.' }, { status: 429 })
                }
            }
            return NextResponse.json({ error: 'Geçersiz doğrulama kodu' }, { status: 401 })
        }

        // Check if expired
        const expiresAt = new Date(twoFactorRecord.expires_at)
        const now = new Date()

        if (now > expiresAt) {
            // Mark as used even if expired
            await db.prepare('UPDATE two_factor_codes SET used = 1 WHERE id = ?').bind(twoFactorRecord.id).run()
            return NextResponse.json({ error: 'Doğrulama kodunun süresi doldu. Lütfen tekrar giriş yapın.' }, { status: 401 })
        }

        // Mark code as used
        await db.prepare('UPDATE two_factor_codes SET used = 1 WHERE id = ?').bind(twoFactorRecord.id).run()

        // Get user
        const user = await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first() as any

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

        response.cookies.set('auth_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        })

        return response

    } catch (error: any) {
        console.error('2FA verify error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
