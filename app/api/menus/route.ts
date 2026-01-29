import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()
        // Fetch only active menus
        const { results } = await db.prepare("SELECT * FROM menus WHERE is_active = 1 ORDER BY sort_order ASC").run()
        return NextResponse.json(results)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
