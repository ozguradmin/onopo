import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { signJWT } from '@/lib/auth'

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
