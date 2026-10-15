import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { createPasswordResetToken } from '@/lib/auth'
import { sendAdminPasswordReset } from '@/lib/email'

// The admin account (ozgurglr256@gmail.com logs in as admin@onopo.com, see /api/auth/login)
const ADMIN_ACCOUNT_EMAIL = 'admin@onopo.com'
// Where the reset link is sent
const RESET_MAIL_TO = 'ozgurglr256@gmail.com'
const ACCEPTED_EMAILS = [RESET_MAIL_TO, ADMIN_ACCOUNT_EMAIL]

const RESET_EXPIRES_MINUTES = 30
// Ignore repeated requests within this window so the endpoint can't be used to flood the inbox
const RESEND_COOLDOWN_MS = 2 * 60 * 1000

const GENERIC_MESSAGE = 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'

// Sends a time-limited, single-use reset link. The password itself is not changed here.
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json().catch(() => ({}))

        if (typeof email !== 'string' || !ACCEPTED_EMAILS.includes(email.trim().toLowerCase())) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }

        const db = await getDB()

        const lastSent = await db.prepare(
            "SELECT value FROM site_settings WHERE key = 'admin_reset_last_sent'"
        ).first() as any
        if (lastSent?.value && Date.now() - Number(lastSent.value) < RESEND_COOLDOWN_MS) {
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }

        const user = await db.prepare(
            "SELECT id, password_hash FROM users WHERE email = ? AND role = 'admin'"
        ).bind(ADMIN_ACCOUNT_EMAIL).first() as any
        if (!user) {
            console.error('Forgot password: admin account not found')
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }

        await db.prepare(
            'INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)'
        ).bind('admin_reset_last_sent', Date.now().toString()).run()

        const token = await createPasswordResetToken(user.id, user.password_hash, RESET_EXPIRES_MINUTES)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'
        const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`

        const result = await sendAdminPasswordReset(resetUrl, RESET_EXPIRES_MINUTES, RESET_MAIL_TO)
        if (!result.success) {
            return NextResponse.json({ error: 'Şifre sıfırlama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.' }, { status: 502 })
        }

        return NextResponse.json({ success: true, message: GENERIC_MESSAGE })

    } catch (error: any) {
        console.error('Forgot password error:', error)
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
    }
}
