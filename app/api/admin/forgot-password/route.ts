import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { createPasswordResetToken } from '@/lib/auth'
import { sendAdminPasswordReset } from '@/lib/email'
import { ADMIN_ACCOUNT_EMAIL, isLoginAlias, normalizeEmail } from '@/lib/login-alias'

// Resets the admin account (ADMIN_ACCOUNT_EMAIL). Accepted e-mails: the login alias (lib/login-alias.ts)
// and the admin account's own e-mail. The link goes to the login alias address.

const RESET_EXPIRES_MINUTES = 30
// Ignore repeated requests within this window so the endpoint can't be used to flood the inbox
const RESEND_COOLDOWN_MS = 2 * 60 * 1000

const GENERIC_MESSAGE = 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.'

// When the admin account's own e-mail was typed, the alias address is not in the request. Logins with the
// alias store it as the 2FA recipient (two_factor_codes.email_sent_to), so the latest such row gives it.
async function findAliasAddress(db: any, userId: number): Promise<string | null> {
    const { results } = await db.prepare(
        "SELECT email_sent_to FROM two_factor_codes WHERE user_id = ? AND email_sent_to != '' ORDER BY id DESC LIMIT 20"
    ).bind(userId).all() as { results: { email_sent_to: string }[] }
    for (const row of results || []) {
        if (await isLoginAlias(row.email_sent_to)) return normalizeEmail(row.email_sent_to)
    }
    return null
}

// Sends a time-limited, single-use reset link. The password itself is not changed here.
export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json().catch(() => ({}))

        if (typeof email !== 'string' || !email.trim()) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({ success: true, message: GENERIC_MESSAGE })
        }
        const typedEmail = normalizeEmail(email)
        const typedAlias = await isLoginAlias(typedEmail)
        if (!typedAlias && typedEmail !== ADMIN_ACCOUNT_EMAIL) {
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

        // The login alias address; if it can't be known (admin e-mail typed and no alias login on record),
        // admin_email from site settings, else the admin account's own e-mail
        const aliasAddress = typedAlias ? typedEmail : await findAliasAddress(db, user.id)
        let recipient: string = aliasAddress || ADMIN_ACCOUNT_EMAIL
        if (!aliasAddress) {
            const adminEmailRow = await db.prepare(
                "SELECT value FROM site_settings WHERE key = 'admin_email'"
            ).first() as any
            const adminEmail = typeof adminEmailRow?.value === 'string' ? adminEmailRow.value.trim() : ''
            if (adminEmail) recipient = adminEmail
        }

        await db.prepare(
            'INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)'
        ).bind('admin_reset_last_sent', Date.now().toString()).run()

        const token = await createPasswordResetToken(user.id, user.password_hash, RESET_EXPIRES_MINUTES)
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'
        const resetUrl = `${baseUrl}/admin/reset-password?token=${encodeURIComponent(token)}`

        const result = await sendAdminPasswordReset(resetUrl, RESET_EXPIRES_MINUTES, recipient)
        if (!result.success) {
            return NextResponse.json({ error: 'Şifre sıfırlama e-postası gönderilemedi. Lütfen daha sonra tekrar deneyin.' }, { status: 502 })
        }

        return NextResponse.json({ success: true, message: GENERIC_MESSAGE })

    } catch (error: any) {
        console.error('Forgot password error:', error)
        return NextResponse.json({ error: 'Bir hata oluştu' }, { status: 500 })
    }
}
