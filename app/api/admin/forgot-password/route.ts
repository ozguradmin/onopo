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
            return NextResponse.json({ success: true, message: 'Eğer bu e-posta kayıtlıysa, şifre sıfırlandı.' })
        }

        // Generate a new random password
        const newPassword = generateRandomPassword()
        const db = await getDB()
        const passwordHash = await hashPassword(newPassword)

        // Update admin password
        await db.prepare(
            'UPDATE users SET password_hash = ? WHERE email = ?'
        ).bind(passwordHash, ADMIN_EMAIL).run()

        // Try to send email with MailChannels
        let emailSent = false
        try {
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
                        email: 'no-reply@onopo-app.workers.dev',
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
                        }
                    ]
                })
            })

            if (emailResponse.ok) {
                emailSent = true
            } else {
                console.error('MailChannels error:', await emailResponse.text())
            }
        } catch (emailError) {
            console.error('Email sending error:', emailError)
        }

        // Log password to console for backup
        console.log('========================================')
        console.log('PASSWORD RESET COMPLETED')
        console.log(`Email: ${ADMIN_EMAIL}`)
        console.log(`New Password: ${newPassword}`)
        console.log('========================================')

        if (emailSent) {
            return NextResponse.json({
                success: true,
                message: `Şifre yenileme maili ${ADMIN_EMAIL} adresine gönderildi.`
            })
        } else {
            // Return the new password directly since email couldn't be sent
            return NextResponse.json({
                success: true,
                message: `Şifreniz sıfırlandı. E-posta gönderilemedi.`,
                newPassword: newPassword,
                email: ADMIN_EMAIL
            })
        }

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
