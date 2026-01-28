import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

// Admin email for password reset
const ADMIN_EMAIL = 'ozgurglr256@gmail.com'

export async function POST(req: NextRequest) {
    try {
        const { email } = await req.json()

        // Verify the email matches admin email
        if (email !== ADMIN_EMAIL) {
            // Don't reveal if email exists or not for security
            return NextResponse.json({ success: true, message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlama bağlantısı gönderildi.' })
        }

        // Generate a new random password
        const newPassword = generateRandomPassword()
        const db = await getDB()
        const passwordHash = await hashPassword(newPassword)

        // Update admin password
        await db.prepare(
            'UPDATE users SET password_hash = ? WHERE email = ?'
        ).bind(passwordHash, ADMIN_EMAIL).run()

        // Send email with MailChannels via Cloudflare Workers
        // MailChannels is integrated with Cloudflare Workers and allows sending emails
        const emailResponse = await fetch('https://api.mailchannels.net/tx/v1/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                personalizations: [
                    {
                        to: [{ email: ADMIN_EMAIL, name: 'Admin' }]
                    }
                ],
                from: {
                    email: 'no-reply@onopo.com.tr',
                    name: 'Onopo Admin'
                },
                subject: 'Onopo Admin - Şifre Sıfırlama',
                content: [
                    {
                        type: 'text/plain',
                        value: `Merhaba,

Admin şifreniz sıfırlandı. Yeni giriş bilgileriniz:

E-posta: ${ADMIN_EMAIL}
Yeni Şifre: ${newPassword}

Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.

Bu e-posta Onopo Admin paneli tarafından gönderilmiştir.`
                    },
                    {
                        type: 'text/html',
                        value: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                <h1 style="color: #1e293b; margin-bottom: 24px;">Şifre Sıfırlama</h1>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6;">
                                    Admin şifreniz sıfırlandı. Yeni giriş bilgileriniz:
                                </p>
                                <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
                                    <p style="margin: 0 0 12px 0;"><strong>E-posta:</strong> ${ADMIN_EMAIL}</p>
                                    <p style="margin: 0;"><strong>Yeni Şifre:</strong> <code style="background: #e2e8f0; padding: 4px 8px; border-radius: 4px;">${newPassword}</code></p>
                                </div>
                                <p style="color: #64748b; font-size: 14px;">
                                    Güvenliğiniz için giriş yaptıktan sonra şifrenizi değiştirmenizi öneririz.
                                </p>
                                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;">
                                <p style="color: #94a3b8; font-size: 12px;">
                                    Bu e-posta Onopo Admin paneli tarafından gönderilmiştir.
                                </p>
                            </div>
                        `
                    }
                ]
            })
        })

        if (!emailResponse.ok) {
            const errorText = await emailResponse.text()
            console.error('MailChannels error:', errorText)

            // Still return success since password was updated - just log the email error
            console.log('========================================')
            console.log('PASSWORD RESET - Email sending failed')
            console.log(`New Password for ${ADMIN_EMAIL}: ${newPassword}`)
            console.log('========================================')

            return NextResponse.json({
                success: true,
                message: `Şifre güncellendi. E-posta gönderilemedi, lütfen logları kontrol edin.`
            })
        }

        return NextResponse.json({
            success: true,
            message: `Şifre yenileme maili ${ADMIN_EMAIL} adresine gönderildi.`
        })

    } catch (error: any) {
        console.error('Forgot password error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function generateRandomPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
    let password = ''
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return password
}
