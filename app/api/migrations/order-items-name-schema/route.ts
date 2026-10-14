import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()

        // Add product_name column to order_items table if it doesn't exist
        // using a try-catch block for safety if it already exists (though IF NOT EXISTS works for tables, simpler for columns in sqlite sometimes requires standard alter)
        // SQLite supports ALTER TABLE ADD COLUMN.

        await db.prepare('ALTER TABLE order_items ADD COLUMN product_name TEXT').run()

        return NextResponse.json({ success: true, message: 'Schema updated: added product_name to order_items' })
    } catch (error: any) {
        // If column already exists, it might throw an error, which is fine
        if (error.message.includes('duplicate column name')) {
            return NextResponse.json({ success: true, message: 'Column already exists' })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
