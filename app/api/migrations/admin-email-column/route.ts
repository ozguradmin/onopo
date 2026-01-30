import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

async function runMigration() {
    const db = await getDB()

    // Add admin_email column to site_settings if it doesn't exist
    // SQLite doesn't have IF NOT EXISTS for columns, so we try-catch
    try {
        await db.prepare(`ALTER TABLE site_settings ADD COLUMN admin_email TEXT`).run()
    } catch (e: any) {
        // Column might already exist - that's ok
        if (!e.message?.includes('duplicate column')) {
            console.log('admin_email column may already exist:', e.message)
        }
    }

    return { success: true, message: 'Admin email column added to site_settings' }
}

// GET method for easy browser access
export async function GET() {
    try {
        const result = await runMigration()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Admin email migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST() {
    try {
        const result = await runMigration()
        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Admin email migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
