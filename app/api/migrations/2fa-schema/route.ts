import { requireAdmin } from '@/lib/auth'
import { postOnly } from '@/lib/api-request'
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function runMigration() {
    const db = await getDB()

    // Create two_factor_codes table for 2FA authentication
    await db.prepare(`
        CREATE TABLE IF NOT EXISTS two_factor_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            code TEXT NOT NULL,
            email_sent_to TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `).run()

    // Create index for faster lookups
    await db.prepare(`
        CREATE INDEX IF NOT EXISTS idx_2fa_user_code ON two_factor_codes(user_id, code, used)
    `).run()

    return { success: true, message: 'Two-factor authentication table created successfully' }
}

// GET changes nothing (a link or prefetch must never alter the database); this runs on an admin POST
export function GET() {
    return postOnly()
}

export async function POST() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        return NextResponse.json(await runMigration())
    } catch (error: any) {
        console.error('2FA migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
