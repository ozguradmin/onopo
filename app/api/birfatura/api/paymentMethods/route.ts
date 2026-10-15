import { NextRequest, NextResponse } from 'next/server'
import { checkBirfaturaToken, PAYMENT_METHODS } from '@/lib/birfatura'

export const dynamic = 'force-dynamic'

// BirFatura: ödeme yöntemlerini getirme
export async function POST(req: NextRequest) {
    const denied = await checkBirfaturaToken(req)
    if (denied) return denied

    return NextResponse.json({
        PaymentMethods: PAYMENT_METHODS.map(p => ({ Id: p.id, Value: p.label }))
    })
}
