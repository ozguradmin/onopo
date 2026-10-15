import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { checkBirfaturaToken, ensureInvoiceColumns, readJsonBody } from '@/lib/birfatura'

export const dynamic = 'force-dynamic'

// Fatura bağlantısı yalnızca BirFatura alan adlarından kabul edilir (müşteriye gösteriliyor)
function isBirfaturaUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'https:' && (url.hostname === 'birfatura.com' || url.hostname.endsWith('.birfatura.com'))
    } catch {
        return false
    }
}

// BirFatura: fatura bağlantısını güncelleme (tekrar gelirse aynı değerleri yazar)
export async function POST(req: NextRequest) {
    const denied = await checkBirfaturaToken(req)
    if (denied) return denied

    const body = await readJsonBody(req)
    const orderId = Number(body?.orderId)
    const faturaUrl = typeof body?.faturaUrl === 'string' ? body.faturaUrl.trim() : ''
    if (!Number.isInteger(orderId) || orderId <= 0 || !faturaUrl) {
        return NextResponse.json({ Success: false, Message: 'orderId ve faturaUrl zorunlu' }, { status: 400 })
    }
    if (!isBirfaturaUrl(faturaUrl)) {
        return NextResponse.json({ Success: false, Message: 'faturaUrl birfatura.com adresinde olmalı' }, { status: 400 })
    }

    try {
        const db = await getDB()
        const order = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first()
        if (!order) return NextResponse.json({ Success: false, Message: 'Sipariş bulunamadı' }, { status: 404 })

        await ensureInvoiceColumns(db)
        // Tekrar gelen bildirimde olmayan numara/tarih mevcut değeri silmez
        await db.prepare(
            'UPDATE orders SET invoice_url = ?, invoice_no = COALESCE(?, invoice_no), invoice_date = COALESCE(?, invoice_date) WHERE id = ?'
        ).bind(
            faturaUrl.slice(0, 1000),
            typeof body.faturaNo === 'string' ? body.faturaNo.trim().slice(0, 50) || null : null,
            typeof body.faturaTarihi === 'string' ? body.faturaTarihi.trim().slice(0, 30) || null : null,
            orderId
        ).run()

        return NextResponse.json({ Success: true, Message: 'Fatura bağlantısı güncellendi.' })
    } catch (error: any) {
        console.error('BirFatura invoice link error:', error)
        return NextResponse.json({ Success: false, Message: 'Fatura bağlantısı güncellenemedi' }, { status: 500 })
    }
}
