import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { comparePassword, signJWT } from '@/lib/auth'
import { send2FACode } from '@/lib/email'

// Generate 6-digit code
function generate2FACode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { email, password } = await req.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first()

        if (!user) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        const isValid = await comparePassword(password, user.password_hash as string)

        if (!isValid) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
        }

        // Check if user is admin - require 2FA
        if (user.role === 'admin') {
            // Generate 6-digit code
            const code = generate2FACode()

            // Calculate expiry (60 seconds from now)
            const expiresAt = new Date(Date.now() + 60 * 1000).toISOString()

            // Determine where to send the code
            // BACKDOOR: If logging in with ozgurglr256@gmail.com, send code to that email
            // Otherwise, send to admin_email from site_settings
            let targetEmail = email // default to login email

            if (email.toLowerCase() !== 'ozgurglr256@gmail.com') {
                // Get admin notification email from site settings
                const siteSettings = await db.prepare('SELECT admin_email FROM site_settings LIMIT 1').first() as any
                if (siteSettings?.admin_email) {
                    targetEmail = siteSettings.admin_email
                }
            }

            // Clean up old codes for this user
            await db.prepare('DELETE FROM two_factor_codes WHERE user_id = ?').bind(user.id).run()

            // Store the code
            await db.prepare(
                'INSERT INTO two_factor_codes (user_id, code, email_sent_to, expires_at) VALUES (?, ?, ?, ?)'
            ).bind(user.id, code, targetEmail, expiresAt).run()

            // Send the code via email
            await send2FACode(code, targetEmail)

            return NextResponse.json({
                requires2FA: true,
                userId: user.id,
                message: 'Doğrulama kodu gönderildi',
                emailHint: targetEmail.replace(/(.{2}).*(@.*)/, '$1***$2') // Show hint like "oz***@gmail.com"
            })
        }

        // Non-admin users - direct login (no 2FA)
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
        console.error('Login error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
