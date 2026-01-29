
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()

        await db.prepare(`
            CREATE TABLE IF NOT EXISTS payment_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT DEFAULT 'offline', -- 'offline', 'paytr', 'iyzico'
                is_active INTEGER DEFAULT 0,
                api_key TEXT,
                secret_key TEXT,
                merchant_id TEXT,
                base_url TEXT,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run()

        // Insert default record if not exists
        const existing = await db.prepare('SELECT id FROM payment_settings LIMIT 1').first()
        if (!existing) {
            await db.prepare(`
                INSERT INTO payment_settings (provider, is_active, api_key, secret_key, merchant_id, base_url)
                VALUES ('offline', 1, '', '', '', '')
            `).run()
            console.log("Created default payment settings")
        }

        return NextResponse.json({ success: true, message: "Payment settings table created" })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
