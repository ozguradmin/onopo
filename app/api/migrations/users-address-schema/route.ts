import { requireAdmin } from '@/lib/auth'
import { postOnly } from '@/lib/api-request'
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function POST(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const db = await getDB()

        // Add city, district, postal_code columns to users table
        const alterStatements = [
            `ALTER TABLE users ADD COLUMN city TEXT DEFAULT ''`,
            `ALTER TABLE users ADD COLUMN district TEXT DEFAULT ''`,
            `ALTER TABLE users ADD COLUMN postal_code TEXT DEFAULT ''`
        ]

        const results = []

        for (const sql of alterStatements) {
            try {
                await db.prepare(sql).run()
                results.push({ sql, status: 'success' })
            } catch (error: any) {
                // Column might already exist
                if (error.message?.includes('duplicate column name')) {
                    results.push({ sql, status: 'already exists' })
                } else {
                    results.push({ sql, status: 'error', error: error.message })
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: 'Users address schema migration completed',
            results
        })

    } catch (error: any) {
        console.error('Migration error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// GET changes nothing (a link or prefetch must never alter the database); this runs on an admin POST
export function GET() {
    return postOnly()
}
