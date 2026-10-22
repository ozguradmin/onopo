// Admin login alias.
//
// The owner signs in to the admin account (ADMIN_ACCOUNT_EMAIL) with a personal e-mail address and
// receives the 2FA code and the password-reset link at that address (app/api/auth/login and
// app/api/admin/forgot-password). This repository is public, so the address itself is not written here:
// only the SHA-256 of its trimmed, lowercased form. The code and the link go to the address the owner
// typed, which is the alias whenever the hash matches (otherwise see adminMailRecipient below).

export const ADMIN_ACCOUNT_EMAIL = 'admin@onopo.com'

const LOGIN_ALIAS_SHA256 = '1642900884f6bb3829c9961161e29d35a4aec76ac72b70887313e8ecf9f8c841'

export function normalizeEmail(email: string): string {
    return email.trim().toLowerCase()
}

async function sha256Hex(value: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
}

/** True when `email` is the owner's login alias (case and surrounding spaces ignored). */
export async function isLoginAlias(email: unknown): Promise<boolean> {
    if (typeof email !== 'string') return false
    const normalized = normalizeEmail(email)
    if (!normalized.includes('@')) return false
    return (await sha256Hex(normalized)) === LOGIN_ALIAS_SHA256
}

/** A configured admin mail address, or null when it is empty, malformed or the admin account's own e-mail. */
export function usableAdminRecipient(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const address = value.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) return null
    if (normalizeEmail(address) === ADMIN_ACCOUNT_EMAIL) return null
    return address
}

type SettingsDB = { prepare(sql: string): { first(): Promise<unknown> } }

/**
 * Where the admin 2FA code (app/api/auth/login) and the password-reset link (app/api/admin/forgot-password)
 * go, in one order for both: the login alias address the request is known to come from, else the
 * ADMIN_RESET_EMAIL Worker secret (an explicit operator choice), else site_settings.admin_email (Site
 * Ayarları). Never ADMIN_ACCOUNT_EMAIL (admin@onopo.com: that domain's mail is not the store's); null when
 * no address is usable.
 */
export async function adminMailRecipient(db: SettingsDB, aliasAddress: string | null): Promise<string | null> {
    if (aliasAddress) return aliasAddress
    const secret = usableAdminRecipient(process.env.ADMIN_RESET_EMAIL)
    if (secret) return secret
    try {
        const row = await db.prepare("SELECT value FROM site_settings WHERE key = 'admin_email'").first() as { value?: unknown } | null
        return usableAdminRecipient(row?.value)
    } catch {
        console.error('[admin mail] admin_email setting could not be read')
        return null
    }
}
