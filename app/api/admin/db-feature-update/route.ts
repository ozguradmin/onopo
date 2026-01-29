
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results = []

        // 1. Add Product Code & WhatsApp fields to products
        try {
            await db.prepare('ALTER TABLE products ADD COLUMN product_code TEXT').run()
            results.push('Added product_code to products')
        } catch (e: any) { results.push(`product_code: ${e.message}`) }

        try {
            await db.prepare('ALTER TABLE products ADD COLUMN whatsapp_order_enabled INTEGER DEFAULT 0').run()
            results.push('Added whatsapp_order_enabled to products')
        } catch (e: any) { results.push(`whatsapp_order_enabled: ${e.message}`) }

        try {
            await db.prepare('ALTER TABLE products ADD COLUMN whatsapp_number TEXT').run()
            results.push('Added whatsapp_number to products')
        } catch (e: any) { results.push(`whatsapp_number: ${e.message}`) }

        // 2. Create Menus table
        try {
            await db.prepare(`
                CREATE TABLE IF NOT EXISTS menus (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    items TEXT, -- JSON array of {label, href, type}
                    display_order INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run()
            results.push('Created menus table')
        } catch (e: any) { results.push(`menus table: ${e.message}`) }

        return NextResponse.json({
            success: true,
            message: 'Schema updated for features',
            logs: results
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
