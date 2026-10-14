import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// This endpoint returns the PayTR taksit token for the embed script
// The token is stored in payment_settings and is provided by PayTR panel
export async function GET() {
    try {
        const db = await getDB()

        // First ensure the column exists
        try {
            await db.prepare(`ALTER TABLE payment_settings ADD COLUMN taksit_token TEXT`).run()
        } catch (e) {
            // Column already exists, ignore
        }

        const settings = await db.prepare('SELECT taksit_token, merchant_id FROM payment_settings LIMIT 1').first() as any

        if (!settings || !settings.merchant_id) {
            return NextResponse.json({ error: 'Payment settings not configured' }, { status: 400 })
        }

        return NextResponse.json({
            token: settings.taksit_token || null,
            merchant_id: settings.merchant_id
        })
    } catch (error: any) {
        console.error('Installment token API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
