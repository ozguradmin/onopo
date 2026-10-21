import { requireAdmin } from '@/lib/auth'
import { postOnly } from '@/lib/api-request'

import { getDB } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const db = await getDB()
        try {
            await db.prepare('ALTER TABLE products ADD COLUMN free_shipping BOOLEAN DEFAULT 0').run()
            return NextResponse.json({ message: 'Added free_shipping column' })
        } catch (e: any) {
            if (e.message.includes('duplicate column')) {
                return NextResponse.json({ message: 'Column already exists' })
            }
            throw e
        }
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// GET changes nothing (a link or prefetch must never alter the database); this runs on an admin POST
export function GET() {
    return postOnly()
}
