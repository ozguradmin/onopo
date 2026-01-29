
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT * FROM coupons ORDER BY created_at DESC').all()
        return NextResponse.json(results || [])
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { code, discount_type, discount_value, min_spend, usage_limit, expires_at } = body

        if (!code || !discount_value) {
            return NextResponse.json({ error: 'Kod ve indirim değeri zorunludur' }, { status: 400 })
        }

        const db = await getDB()

        // Check duplicate
        const existing = await db.prepare('SELECT id FROM coupons WHERE code = ?').bind(code).first()
        if (existing) {
            return NextResponse.json({ error: 'Bu kupon kodu zaten var' }, { status: 400 })
        }

        const res = await db.prepare(`
            INSERT INTO coupons (code, discount_type, discount_value, min_spend, usage_limit, expires_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
            code.toUpperCase(),
            discount_type || 'fixed',
            discount_value,
            min_spend || 0,
            usage_limit || 0,
            expires_at || null
        ).run()

        return NextResponse.json({ success: true, id: res.meta.last_row_id })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
