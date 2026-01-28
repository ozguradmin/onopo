
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'



export async function GET(req: NextRequest) {
    try {
        const db = await getDB()

        const results = []

        // 1. Ensure is_active column exists in products
        try {
            await db.prepare('ALTER TABLE products ADD COLUMN is_active INTEGER DEFAULT 1').run()
            results.push('Added is_active column to products')
        } catch (e: any) {
            results.push(`products.is_active check: ${e.message}`)
        }

        // 2. Ensure order_items exists (it should, but just in case)
        try {
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS order_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    order_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL,
                    price_at_purchase REAL NOT NULL,
                    name TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
                )
            `).run()
            results.push('Checked/Created order_items table')
        } catch (e: any) {
            results.push(`order_items check: ${e.message}`)
        }

        // 3. Fix admin user just in case (reset password logic check)
        // Not doing unsafe things here.

        return NextResponse.json({
            success: true,
            message: 'Database check completed',
            logs: results
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
