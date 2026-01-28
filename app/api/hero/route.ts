import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            'SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order ASC'
        ).all()

        return NextResponse.json(results)
    } catch (error: any) {
        console.error('Failed to fetch hero slides:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
