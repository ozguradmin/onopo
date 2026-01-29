
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { code, cartTotal } = body

        if (!code) {
            return NextResponse.json({ error: 'Kupon kodu giriniz' }, { status: 400 })
        }

        const db = await getDB()
        const coupon = await db.prepare('SELECT * FROM coupons WHERE code = ? AND is_active = 1').bind(code.toUpperCase()).first()

        if (!coupon) {
            return NextResponse.json({ error: 'Geçersiz kupon kodu' }, { status: 404 })
        }

        // Check expiration
        if (coupon.expires_at) {
            const now = new Date()
            const expiry = new Date(coupon.expires_at)
            if (now > expiry) {
                return NextResponse.json({ error: 'Bu kuponun süresi dolmuş' }, { status: 400 })
            }
        }

        // Check usage limit
        if (coupon.usage_limit > 0 && coupon.usage_count >= coupon.usage_limit) {
            return NextResponse.json({ error: 'Bu kupon kullanım limitine ulaşmış' }, { status: 400 })
        }

        // Check min spend
        if (coupon.min_spend > 0 && cartTotal < coupon.min_spend) {
            return NextResponse.json({
                error: `Bu kupon min. ${coupon.min_spend} TL alışverişlerde geçerli`
            }, { status: 400 })
        }

        return NextResponse.json({
            success: true,
            code: coupon.code,
            discount_type: coupon.discount_type,
            discount_value: coupon.discount_value
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
