import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const db = await getDB()

        // Create product_variations table
        await db.exec(`
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
        `)

        // Create index for faster lookups
        await db.exec(`
            CREATE INDEX IF NOT EXISTS idx_variations_product_id ON product_variations(product_id)
        `)

        return NextResponse.json({
            success: true,
            message: 'product_variations tablosu başarıyla oluşturuldu'
        })
    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
