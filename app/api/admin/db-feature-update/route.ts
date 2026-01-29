
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

        // 2. Create/Update Menus table (Schema Correction)
        try {
            // Check if table exists first to perform safe migration or simple create
            // For now, we'll try to create it with correct columns. 
            // Since D1 doesn't support easy column alterations for constraints, we'll use CREATE IF NOT EXISTS
            // and separate ALTERs for missing columns if it already exists with diff schema.

            await db.prepare(`
                CREATE TABLE IF NOT EXISTS menus (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    url TEXT DEFAULT '#',
                    parent_id INTEGER,
                    sort_order INTEGER DEFAULT 0,
                    is_active INTEGER DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run()
            results.push('Created menus table (if not exists)')

            // Attempt to add columns if table existed but missed them (backward compat with previous wrong schema)
            try { await db.prepare('ALTER TABLE menus ADD COLUMN url TEXT DEFAULT "#"').run(); } catch (e) { }
            try { await db.prepare('ALTER TABLE menus ADD COLUMN parent_id INTEGER').run(); } catch (e) { }
            try { await db.prepare('ALTER TABLE menus ADD COLUMN sort_order INTEGER DEFAULT 0').run(); } catch (e) { }
            try { await db.prepare('ALTER TABLE menus ADD COLUMN is_active INTEGER DEFAULT 1').run(); } catch (e) { }

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
