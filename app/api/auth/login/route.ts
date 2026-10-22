import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { comparePassword, signJWT } from '@/lib/auth'
import { send2FACode } from '@/lib/email'
import { readJsonBody } from '@/lib/api-request'
import { ADMIN_ACCOUNT_EMAIL, isLoginAlias, normalizeEmail } from '@/lib/login-alias'
import { TWO_FACTOR_TTL_MS, ensureChallengeTable, newChallengeId, setChallengeCookie, setSessionCookies } from '../two-factor'

// Generate 6-digit code (crypto RNG)
function generate2FACode(): string {
    const [n] = crypto.getRandomValues(new Uint32Array(1))
    return (100000 + (n % 900000)).toString()
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const { email, password } = parsed.body

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        // Login alias (lib/login-alias.ts): the owner's personal e-mail signs in to the admin account
        const loginAlias = await isLoginAlias(email)
        const lookupEmail = loginAlias ? ADMIN_ACCOUNT_EMAIL : email

        const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(lookupEmail).first()

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

            // Calculate expiry (TWO_FACTOR_TTL_MS from now)
            const expiresAt = new Date(Date.now() + TWO_FACTOR_TTL_MS).toISOString()

            // Login alias: the code goes to the alias address that was typed. Otherwise it goes to admin_email
            // from site settings (Site Ayarları), or to the account's own e-mail when that setting is empty.
            let targetEmail = user.email as string
            if (loginAlias) {
                targetEmail = normalizeEmail(email)
            } else {
                try {
                    const settingRow = await db.prepare("SELECT value FROM site_settings WHERE key = 'admin_email'").first() as any
                    if (typeof settingRow?.value === 'string' && settingRow.value.trim()) {
                        targetEmail = settingRow.value.trim()
                    }
                } catch (e) {
                    console.error('[Login] admin_email setting could not be read, using the account e-mail')
                }
            }

            // One transaction: this user's old codes and challenges (and anyone's expired challenges) go, the new
            // code and the challenge bound to this login are stored (two-factor.ts). The challenge id goes into
            // an HttpOnly cookie below; verify-2fa accepts the code only together with that cookie.
            const challengeId = newChallengeId()
            await ensureChallengeTable(db)
            await db.batch([
                db.prepare('DELETE FROM two_factor_codes WHERE user_id = ?').bind(user.id),
                db.prepare('DELETE FROM two_factor_challenges WHERE user_id = ? OR expires_at < ?').bind(user.id, new Date().toISOString()),
                db.prepare(
                    'INSERT INTO two_factor_codes (user_id, code, email_sent_to, expires_at) VALUES (?, ?, ?, ?)'
                ).bind(user.id, code, targetEmail, expiresAt),
                db.prepare(
                    'INSERT INTO two_factor_challenges (id, user_id, code_id, expires_at) ' +
                    'VALUES (?, ?, (SELECT id FROM two_factor_codes WHERE user_id = ? ORDER BY id DESC LIMIT 1), ?)'
                ).bind(challengeId, user.id, user.id, expiresAt),
            ])

            // Send the code via email. If it can't be sent, say so instead of waiting for a code that never comes
            // (the challenge cookie is set anyway: the code is stored, and a new login replaces both)
            const sent = await send2FACode(code, targetEmail)
            if (!sent.success) {
                const failed = NextResponse.json(
                    { error: 'Doğrulama kodu e-postası gönderilemedi. Lütfen biraz sonra tekrar deneyin.' },
                    { status: 502 }
                )
                setChallengeCookie(failed, challengeId)
                return failed
            }

            const challenge = NextResponse.json({
                requires2FA: true,
                userId: user.id,
                message: 'Doğrulama kodu gönderildi',
                emailHint: targetEmail.replace(/(.{2}).*(@.*)/, '$1***$2') // Show hint like "oz***@gmail.com"
            })
            setChallengeCookie(challenge, challengeId)
            return challenge
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

        setSessionCookies(response, token)

        return response

    } catch (error: any) {
        console.error('Login error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
