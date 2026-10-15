import { NextRequest, NextResponse } from 'next/server'
import { checkBirfaturaToken, ORDER_STATUSES } from '@/lib/birfatura'

export const dynamic = 'force-dynamic'

// BirFatura: sipariş durumlarını getirme
export async function POST(req: NextRequest) {
    const denied = await checkBirfaturaToken(req)
    if (denied) return denied

    return NextResponse.json({
        OrderStatus: ORDER_STATUSES.map(s => ({ Id: s.id, Value: s.label }))
    })
}
