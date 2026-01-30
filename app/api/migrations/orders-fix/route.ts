import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Migration to add missing columns to orders table
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results: string[] = []

        // Add payment_status column if missing
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`).run()
            results.push('Added payment_status column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('payment_status column already exists')
            } else {
                results.push('payment_status: ' + e.message)
            }
        }

        // Add tracking_number column if missing
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN tracking_number TEXT`).run()
            results.push('Added tracking_number column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('tracking_number column already exists')
            } else {
                results.push('tracking_number: ' + e.message)
            }
        }

        // Add shipping_company column if missing
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN shipping_company TEXT`).run()
            results.push('Added shipping_company column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('shipping_company column already exists')
            } else {
                results.push('shipping_company: ' + e.message)
            }
        }

        // Add payment_id column if missing
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN payment_id TEXT`).run()
            results.push('Added payment_id column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('payment_id column already exists')
            } else {
                results.push('payment_id: ' + e.message)
            }
        }

        // Add items column if missing (stores order items as JSON)
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN items TEXT`).run()
            results.push('Added items column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('items column already exists')
            } else {
                results.push('items: ' + e.message)
            }
        }

        // Add admin_notes column if missing
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN admin_notes TEXT`).run()
            results.push('Added admin_notes column')
        } catch (e: any) {
            if (e.message?.includes('duplicate column')) {
                results.push('admin_notes column already exists')
            } else {
                results.push('admin_notes: ' + e.message)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Migration completed',
            results
        })
    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
