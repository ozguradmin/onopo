import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()

        await db.prepare(`
            CREATE TABLE IF NOT EXISTS shipping_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                free_shipping_threshold DECIMAL(10, 2) DEFAULT 500.00,
                shipping_cost DECIMAL(10, 2) DEFAULT 100.00,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run()

        // Insert default record if not exists
        const existing = await db.prepare('SELECT id FROM shipping_settings LIMIT 1').first()
        if (!existing) {
            await db.prepare(`
                INSERT INTO shipping_settings (free_shipping_threshold, shipping_cost)
                VALUES (500.00, 100.00)
            `).run()
            console.log("Created default shipping settings")
        }

        return NextResponse.json({ success: true, message: "Shipping settings table created" })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
