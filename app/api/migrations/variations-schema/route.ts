import { requireAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const db = await getDB()

        // Create product_variations table
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS product_variations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                product_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                value TEXT NOT NULL,
                price_modifier REAL DEFAULT 0,
                stock INTEGER DEFAULT 0,
                sku TEXT,
                image_url TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            )
        `).run()

        // Create index for faster lookups
        await db.prepare(`
            CREATE INDEX IF NOT EXISTS idx_variations_product_id ON product_variations(product_id)
        `).run()

        return NextResponse.json({
            success: true,
            message: 'product_variations tablosu başarıyla oluşturuldu'
        })
    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
