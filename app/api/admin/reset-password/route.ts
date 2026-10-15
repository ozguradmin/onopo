import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { hashPassword, verifyPasswordResetToken } from '@/lib/auth'

const MIN_PASSWORD_LENGTH = 8

// Completes the reset started by /api/admin/forgot-password
export async function POST(req: NextRequest) {
    try {
        const { token, password } = await req.json().catch(() => ({}))

        if (typeof token !== 'string' || !token) {
            return NextResponse.json({ error: 'Geçersiz bağlantı' }, { status: 400 })
        }
        if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
            return NextResponse.json({ error: `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır` }, { status: 400 })
        }

        const db = await getDB()

        let currentHash: string | null = null
        const userId = await verifyPasswordResetToken(token, async (id) => {
            const user = await db.prepare(
                "SELECT password_hash FROM users WHERE id = ? AND role = 'admin'"
            ).bind(id).first() as any
            currentHash = user?.password_hash ?? null
            return currentHash
        })

        if (!userId) {
            return NextResponse.json({ error: 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Lütfen yeni bir sıfırlama bağlantısı isteyin.' }, { status: 400 })
        }

        // Matching the old hash keeps the link single-use even if it is submitted twice at once
        const passwordHash = await hashPassword(password)
        const result = await db.prepare(
            "UPDATE users SET password_hash = ? WHERE id = ? AND role = 'admin' AND password_hash = ?"
        ).bind(passwordHash, userId, currentHash).run()
        if (!result.meta?.changes) {
            return NextResponse.json({ error: 'Bağlantı daha önce kullanılmış. Lütfen yeni bir sıfırlama bağlantısı isteyin.' }, { status: 400 })
        }

        console.log('Admin password reset completed for user id:', userId)

        return NextResponse.json({ success: true, message: 'Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.' })

    } catch (error: any) {
        console.error('Reset password error:', error)
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
    }
}
