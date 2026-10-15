import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import {
    checkBirfaturaToken,
    DEFAULT_VAT_RATE,
    paymentMethodFor,
    readJsonBody,
    statusFromId,
    taxExcluding,
    trDateToUtcSql,
    utcSqlToTrDate,
} from '@/lib/birfatura'

export const dynamic = 'force-dynamic'

const MAX_ORDERS = 500
const MAX_RANGE_DAYS = 92
const IN_CHUNK = 90 // D1 tek sorguda en fazla 100 parametre kabul ediyor

function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== 'string' || !value) return fallback
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

const SITE_URL = 'https://onopostore.com'

function firstImage(images: unknown): string | null {
    const list = parseJson<unknown>(images, null)
    const first = Array.isArray(list) && typeof list[0] === 'string' ? list[0] : typeof images === 'string' ? images : ''
    if (first.startsWith('http')) return first
    return first.startsWith('/') ? SITE_URL + first : null
}

// Zorunlu alanlar boş gönderilemez
function nonEmpty(...values: unknown[]): string {
    for (const v of values) {
        if (typeof v === 'string' && v.trim()) return v.trim()
    }
    return '-'
}

// BirFatura: siparişleri getirme
export async function POST(req: NextRequest) {
    const denied = await checkBirfaturaToken(req)
    if (denied) return denied

    const body = await readJsonBody(req)
    if (!body) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

    const start = trDateToUtcSql(body.startDateTime)
    const end = trDateToUtcSql(body.endDateTime)
    if (!start || !end || start > end) {
        return NextResponse.json({ error: 'startDateTime ve endDateTime dd.MM.yyyy HH:mm:ss formatında olmalı' }, { status: 400 })
    }
    const rangeDays = (Date.parse(end.replace(' ', 'T') + 'Z') - Date.parse(start.replace(' ', 'T') + 'Z')) / 86400000
    if (rangeDays > MAX_RANGE_DAYS) {
        return NextResponse.json({ error: `Tarih aralığı en fazla ${MAX_RANGE_DAYS} gün olabilir` }, { status: 400 })
    }

    const status = statusFromId(body.orderStatusId)
    if (!status) return NextResponse.json({ Orders: [] })

    try {
        const db = await getDB()
        const { results: orders } = await db.prepare(`
            SELECT o.*, u.email AS user_email, u.full_name AS user_full_name
            FROM orders o
            LEFT JOIN users u ON u.id = o.user_id
            WHERE o.status = ?
              AND o.created_at BETWEEN ? AND ?
              AND COALESCE(o.payment_status, '') != 'failed'
            ORDER BY o.id
            LIMIT ${MAX_ORDERS}
        `).bind(status, start, end).all() as { results: any[] }

        if (!orders || orders.length === 0) return NextResponse.json({ Orders: [] })

        // Sipariş satırları (ürün kodu ve görseli için ürün tablosuyla)
        const linesByOrder = new Map<number, any[]>()
        const ids = orders.map(o => o.id)
        for (let i = 0; i < ids.length; i += IN_CHUNK) {
            const chunk = ids.slice(i, i + IN_CHUNK)
            const { results } = await db.prepare(`
                SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_at_purchase, oi.product_name,
                       p.product_code, p.images, p.name AS current_name
                FROM order_items oi
                LEFT JOIN products p ON p.id = oi.product_id
                WHERE oi.order_id IN (${chunk.map(() => '?').join(',')})
                ORDER BY oi.id
            `).bind(...chunk).all() as { results: any[] }
            for (const row of results || []) {
                const list = linesByOrder.get(row.order_id) || []
                list.push(row)
                linesByOrder.set(row.order_id, list)
            }
        }

        const vat = DEFAULT_VAT_RATE
        const Orders = orders.map(o => {
            const sa = parseJson<Record<string, any>>(o.shipping_address, {})

            // Eski siparişlerde order_items boşsa orders.items JSON'una düş
            let lines = linesByOrder.get(o.id) || []
            if (lines.length === 0) {
                lines = parseJson<any[]>(o.items, []).map(it => ({
                    product_id: it.product_id,
                    quantity: it.quantity,
                    price_at_purchase: it.price,
                    product_name: it.name,
                }))
            }

            const OrderDetails = lines.map(line => {
                const unitIncl = Number(line.price_at_purchase) || 0
                const image = firstImage(line.images)
                return {
                    ProductId: Number(line.product_id) || 0,
                    ProductCode: nonEmpty(line.product_code, `ONOPO-${line.product_id}`),
                    ProductName: nonEmpty(line.product_name, line.current_name),
                    ...(image ? { ProductImage: image } : {}),
                    ProductQuantityType: 'Adet',
                    ProductQuantity: Number(line.quantity) || 1,
                    VatRate: vat,
                    ProductUnitPriceTaxExcluding: taxExcluding(unitIncl, vat),
                    ProductUnitPriceTaxIncluding: unitIncl,
                }
            })

            const productsIncl = OrderDetails.reduce((sum, d) => sum + d.ProductUnitPriceTaxIncluding * d.ProductQuantity, 0)
            const totalIncl = Number(o.total_amount) || 0
            const shippingIncl = typeof sa.shipping_cost === 'number'
                ? sa.shipping_cost
                : Math.max(0, totalIncl - productsIncl)
            // Toplam, ürünler + kargodan düşükse aradaki fark genel iskonto olarak gider
            const discountIncl = Math.max(0, productsIncl + shippingIncl - totalIncl)

            const name = nonEmpty(sa.fullName, o.user_full_name)
            const phone = nonEmpty(sa.phone)
            const separateBilling = !!sa.wantsDifferentBillingAddress && !!(sa.billingAddress || '').trim()
            // Bazı eski siparişlerde il boş, yalnız ilçe dolu; il yerine ilçe gönderilir
            const shippingCity = nonEmpty(sa.city, sa.district)
            const shippingTown = nonEmpty(sa.district, sa.city)
            const billingCity = separateBilling ? nonEmpty(sa.billingCity, sa.billingDistrict, shippingCity) : shippingCity
            const billingTown = separateBilling ? nonEmpty(sa.billingDistrict, sa.billingCity, shippingTown) : shippingTown

            const idNo = String(sa.tcIdentity || '').replace(/\D/g, '')
            const payment = paymentMethodFor(sa.provider)

            return {
                OrderId: o.id,
                OrderCode: String(o.id),
                OrderDate: utcSqlToTrDate(o.created_at),
                CustomerId: o.user_id ?? null,
                BillingName: name,
                BillingAddress: separateBilling ? sa.billingAddress.trim() : nonEmpty(sa.address),
                BillingTown: billingTown,
                BillingCity: billingCity,
                BillingMobilePhone: phone,
                // 10 hane vergi numarası, 11 hane T.C. kimlik numarası; bilinmiyorsa e-Arşiv için 11111111111
                ...(idNo.length === 10 ? { TaxNo: idNo } : { SSNTCNo: idNo.length === 11 ? idNo : '11111111111' }),
                Email: o.guest_email || o.user_email || null,
                ShippingName: name,
                ShippingAddress: nonEmpty(sa.address),
                ShippingTown: shippingTown,
                ShippingCity: shippingCity,
                ShippingCountry: 'Türkiye',
                ShippingZipCode: sa.postalCode || null,
                ShippingPhone: phone,
                ShipCompany: o.shipping_company || null,
                SalesChannelWebSite: SITE_URL,
                PaymentTypeId: payment.id,
                PaymentType: payment.label,
                Currency: 'TRY',
                CurrencyRate: 1,
                TotalPaidTaxExcluding: taxExcluding(totalIncl, vat),
                TotalPaidTaxIncluding: totalIncl,
                ProductsTotalTaxExcluding: taxExcluding(productsIncl, vat),
                ProductsTotalTaxIncluding: productsIncl,
                ShippingChargeTotalTaxExcluding: taxExcluding(shippingIncl, vat),
                ShippingChargeTotalTaxIncluding: shippingIncl,
                DiscountTotalTaxExcluding: taxExcluding(discountIncl, vat),
                DiscountTotalTaxIncluding: discountIncl,
                InvoiceExplanation: sa.note ? String(sa.note).slice(0, 500) : null,
                OrderDetails,
            }
        })

        return NextResponse.json({ Orders })
    } catch (error: any) {
        console.error('BirFatura orders error:', error)
        return NextResponse.json({ error: 'Siparişler alınamadı' }, { status: 500 })
    }
}
