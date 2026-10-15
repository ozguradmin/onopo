import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { checkBirfaturaToken, readJsonBody, statusFromId } from '@/lib/birfatura'

export const dynamic = 'force-dynamic'

// BirFatura: sipariş durumu ve kargo bilgisini güncelleme (tekrar gelirse aynı değerleri yazar)
export async function POST(req: NextRequest) {
    const denied = await checkBirfaturaToken(req)
    if (denied) return denied

    const body = await readJsonBody(req)
    const orderId = Number(body?.orderId)
    const trackingCode = typeof body?.cargoTrackingCode === 'string' ? body.cargoTrackingCode.trim() : ''
    if (!Number.isInteger(orderId) || orderId <= 0 || !trackingCode) {
        return NextResponse.json({ Success: false, Message: 'orderId ve cargoTrackingCode zorunlu' }, { status: 400 })
    }

    try {
        const db = await getDB()
        const order = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first()
        if (!order) return NextResponse.json({ Success: false, Message: 'Sipariş bulunamadı' }, { status: 404 })

        const updates = ['tracking_number = ?']
        const values: any[] = [trackingCode.slice(0, 100)]

        const status = statusFromId(body.orderStatusId)
        if (status) {
            updates.push('status = ?')
            values.push(status)
        }
        if (typeof body.cargoCompany === 'string' && body.cargoCompany.trim()) {
            updates.push('shipping_company = ?')
            values.push(body.cargoCompany.trim().slice(0, 100))
        }
        if (typeof body.cargoTrackingCodeUrl === 'string' && /^https?:\/\//i.test(body.cargoTrackingCodeUrl.trim())) {
            updates.push('tracking_code = ?')
            values.push(body.cargoTrackingCodeUrl.trim().slice(0, 500))
        }

        values.push(orderId)
        await db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()

        return NextResponse.json({ Success: true, Message: 'Kargo bilgisi güncellendi.' })
    } catch (error: any) {
        console.error('BirFatura cargo update error:', error)
        return NextResponse.json({ Success: false, Message: 'Kargo bilgisi güncellenemedi' }, { status: 500 })
    }
}
