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

// GET method for easy browser access
export async function GET() {
    try {
        const result = await runMigration()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('2FA migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST() {
    try {
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

        return NextResponse.json({
            success: true,
            message: 'Two-factor authentication table created successfully'
        })

    } catch (error: any) {
        console.error('2FA migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
