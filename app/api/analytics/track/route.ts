import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function POST(req: Request) {
    try {
        const { page, product_id } = await req.json()
        const db = await getDB()

        await db.prepare('INSERT INTO analytics (page, product_id) VALUES (?, ?)').bind(
            page || '/',
            product_id || null
        ).run()

        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json({ success: false })
    }
}
