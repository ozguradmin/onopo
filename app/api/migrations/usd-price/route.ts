import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Migration to add USD price column to products table
export async function GET() {
    try {
        const db = await getDB()

        // Add price_usd column to products (nullable REAL)
        try {
            await db.prepare(`ALTER TABLE products ADD COLUMN price_usd REAL DEFAULT NULL`).run()
            console.log('Added price_usd column to products')
        } catch (e: any) {
            if (!e.message?.includes('duplicate column')) {
                console.log('price_usd column may already exist:', e.message)
            }
        }

        // Add exchange rate settings
        const settings = [
            { key: 'last_exchange_rate', value: '0' },
            { key: 'last_exchange_update', value: '' },
        ]

        for (const setting of settings) {
            try {
                await db.prepare(
                    `INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)`
                ).bind(setting.key, setting.value).run()
            } catch (e) {
                console.log(`Setting ${setting.key} may already exist`)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'USD price migration completed',
            changes: [
                'Added price_usd column to products table',
                'Added last_exchange_rate setting',
                'Added last_exchange_update setting'
            ]
        })
    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
