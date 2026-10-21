import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// This endpoint returns the PayTR taksit token for the embed script
// The token is stored in payment_settings and is provided by PayTR panel
export async function GET() {
    try {
        const db = await getDB()

        // No DDL on this public GET: payment_settings.taksit_token exists in production
        // (the /api/admin/payment-settings POST adds it on a fresh database)
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
