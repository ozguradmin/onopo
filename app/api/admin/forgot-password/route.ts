import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { createPasswordResetToken } from '@/lib/auth'
import { sendAdminPasswordReset } from '@/lib/email'

// The link is sent to admin_email from site settings (where the 2FA codes go), or to the admin
// account's own e-mail when that setting is empty. The e-mail typed on the login page must be the
// admin account's e-mail or that admin_email; nothing is hard-coded.

const RESET_EXPIRES_MINUTES = 30
// Ignore repeated requests within this window so the endpoint can't be used to flood the inbox
const RESEND_COOLDOWN_MS = 2 * 60 * 1000

const GENERIC_MESSAGE = 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'

// Sends a time-limited, single-use reset link. The password itself is not changed here.
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json().catch(() => ({}))

        if (typeof email !== 'string' || !email.trim()) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }
        const typedEmail = email.trim().toLowerCase()

        const db = await getDB()

        const adminEmailRow = await db.prepare(
            "SELECT value FROM site_settings WHERE key = 'admin_email'"
        ).first() as any
        const adminEmail = typeof adminEmailRow?.value === 'string' ? adminEmailRow.value.trim() : ''

        // The admin account the link resets: the one whose e-mail was typed, or, when admin_email was
        // typed, the oldest admin account
        const typedAdminEmail = adminEmail !== '' && typedEmail === adminEmail.toLowerCase()
        const user = typedAdminEmail
            ? await db.prepare("SELECT id, email, password_hash FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").first() as any
            : await db.prepare("SELECT id, email, password_hash FROM users WHERE role = 'admin' AND lower(email) = ? LIMIT 1").bind(typedEmail).first() as any
        if (!user) {
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }

        const lastSent = await db.prepare(
            "SELECT value FROM site_settings WHERE key = 'admin_reset_last_sent'"
        ).first() as any
        if (lastSent?.value && Date.now() - Number(lastSent.value) < RESEND_COOLDOWN_MS) {
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }

        await db.prepare(
            'INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)'
        ).bind('admin_reset_last_sent', Date.now().toString()).run()

        const token = await createPasswordResetToken(user.id, user.password_hash, RESET_EXPIRES_MINUTES)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'
        const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`

        const result = await sendAdminPasswordReset(resetUrl, RESET_EXPIRES_MINUTES, adminEmail || user.email)
        if (!result.success) {
            return NextResponse.json({ error: 'Şifre sıfırlama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.' }, { status: 502 })
        }

        return NextResponse.json({ success: true, message: GENERIC_MESSAGE })

    } catch (error: any) {
        console.error('Forgot password error:', error)
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
    }
}
