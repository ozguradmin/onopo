import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'



export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { results } = await db.prepare(
            'SELECT * FROM hero_slides WHERE is_active = 1 ORDER BY display_order ASC LIMIT 5'
        ).all()

        // Cache hero slides for 5 minutes (rarely changes)
        return NextResponse.json(results, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error: any) {
        console.error('Failed to fetch hero slides:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
