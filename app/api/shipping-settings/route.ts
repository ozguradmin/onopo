import { requireAdmin } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// An amount in TL: a finite number >= 0 (a numeric string is accepted too), else null
function amount(value: unknown): number | null {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
    return Number.isFinite(n) && n >= 0 ? n : null
}

export async function GET() {
    try {
        const db = await getDB()
        const settings = await db.prepare('SELECT * FROM shipping_settings LIMIT 1').first()

        if (!settings) {
            return NextResponse.json({
                free_shipping_threshold: 500,
                shipping_cost: 100
            })
        }

        return NextResponse.json(settings, {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const body = await req.json()
        // Feeds and the order API read these values: an empty or invalid amount (NULL in the row) would print
        // NaN in the Akakçe/Google feeds, so it is refused instead of stored
        const free_shipping_threshold = amount(body?.free_shipping_threshold)
        const shipping_cost = amount(body?.shipping_cost)
        if (free_shipping_threshold === null || shipping_cost === null) {
            return NextResponse.json(
                { error: 'Ücretsiz kargo limiti ve kargo ücreti 0 ya da daha büyük bir sayı olmalı.' },
                { status: 400 }
            )
        }

        const db = await getDB()

        await db.prepare(`
            UPDATE shipping_settings 
            SET free_shipping_threshold = ?, shipping_cost = ?, updated_at = CURRENT_TIMESTAMP
        `).bind(free_shipping_threshold, shipping_cost).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
