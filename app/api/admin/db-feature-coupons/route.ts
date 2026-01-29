
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results = []

        // Create Coupons Table
        try {
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS coupons (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT UNIQUE NOT NULL,
                    discount_type TEXT DEFAULT 'fixed', -- 'fixed' or 'percent'
                    discount_value REAL NOT NULL,
                    min_spend REAL DEFAULT 0,
                    usage_limit INTEGER DEFAULT 0, -- 0 = infinite
                    usage_count INTEGER DEFAULT 0,
                    expires_at DATETIME,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run()
            results.push('Created coupons table (if not exists)')
        } catch (e: any) { results.push(`coupons table: ${e.message}`) }

        return NextResponse.json({
            success: true,
            message: 'Schema updated for Coupons',
            logs: results
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
