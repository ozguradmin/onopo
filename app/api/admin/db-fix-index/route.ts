
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results = []

        const queries = [
            // Users
            'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',

            // Categories
            'CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug)',

            // Products
            'CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)',
            'CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active)',
            'CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)',

            // Order Items - Critical for joins
            'CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)',
            'CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id)',

            // Orders
            'CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)',

            // Favorites
            'CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_favorites_product_id ON favorites(product_id)',

            // Homepage Sections
            'CREATE INDEX IF NOT EXISTS idx_homepage_sections_is_active ON homepage_sections(is_active)'
        ]

        for (const query of queries) {
            try {
                await db.prepare(query).run()
                results.push(`Success: ${query}`)
            } catch (e: any) {
                results.push(`Error (${query}): ${e.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Database indexes applied',
            logs: results
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
