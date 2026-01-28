import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results = []

        // 1. Add warranty_info
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN warranty_info TEXT").run()
            results.push('Added warranty_info')
        } catch (e: any) {
            results.push('warranty_info exists or error: ' + e.message)
        }

        // 2. Add delivery_info
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN delivery_info TEXT").run()
            results.push('Added delivery_info')
        } catch (e: any) {
            results.push('delivery_info exists or error: ' + e.message)
        }

        // 3. Add installment_info
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN installment_info TEXT").run()
            results.push('Added installment_info')
        } catch (e: any) {
            results.push('installment_info exists or error: ' + e.message)
        }

        // 4. Ensure Analytics
        try {
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS analytics (
                    id INTEGER PRIMARY KEY,
                    page TEXT,
                    product_id INTEGER,
                    user_agent TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                );
            `).run()
            results.push('Ensured analytics table')
        } catch (e: any) {
            results.push('Analytics error: ' + e.message)
        }

        return NextResponse.json({ success: true, results })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
