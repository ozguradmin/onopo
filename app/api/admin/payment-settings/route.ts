
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()
        const settings = await db.prepare('SELECT * FROM payment_settings LIMIT 1').first()
        return NextResponse.json(settings || {})
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const db = await getDB()

        // Upsert logic (simplistic update since we have 1 row)
        await db.prepare(`
            UPDATE payment_settings 
            SET provider = ?, is_active = ?, api_key = ?, secret_key = ?, merchant_id = ?, base_url = ?
            WHERE id = (SELECT id FROM payment_settings LIMIT 1)
        `).bind(
            body.provider,
            body.is_active,
            body.api_key,
            body.secret_key,
            body.merchant_id,
            body.base_url
        ).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
