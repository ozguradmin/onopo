/**
 * Server data for the customer account pages (/profile/, /orders/). Reads the auth_token cookie and D1
 * directly, so the pages render on the server (no client fetch, no spinner, no client redirect).
 * Same rules as the APIs they replace on these pages:
 *   user      → /api/auth/me              (token payload id; users row)
 *   favorites → /api/favorites            (favorites of the user; only ACTIVE products are shown)
 *   orders    → /api/orders/my-orders     (orders with user_id = me OR guest_email = my e-mail)
 * The APIs themselves are unchanged and still used by other clients.
 */
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth'
import { getDB } from '@/lib/db'

export interface AccountUser {
    id: number
    email: string
    fullName: string
    phone: string
    address: string
    city: string
    district: string
    postalCode: string
    role: string
    createdAt: string | null
}

type Row = Record<string, unknown>

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v))

/** The logged-in user, or null (no/invalid token, or the user row no longer exists). */
export const getSessionUser = cache(async (): Promise<AccountUser | null> => {
    const token = (await cookies()).get('auth_token')?.value
    if (!token) return null
    const payload = (await verifyJWT(token)) as Row | null
    const id = Number(payload?.userId ?? payload?.sub ?? payload?.id)
    if (!Number.isInteger(id) || id <= 0) return null

    const db = await getDB()
    const row = await db
        .prepare('SELECT id, email, full_name, phone, address, city, district, postal_code, role, created_at FROM users WHERE id = ?')
        .bind(id)
        .first<Row>()
    if (!row) return null
    return {
        id: Number(row.id),
        email: str(row.email),
        fullName: str(row.full_name),
        phone: str(row.phone),
        address: str(row.address),
        city: str(row.city),
        district: str(row.district),
        postalCode: str(row.postal_code),
        role: str(row.role) || 'user',
        createdAt: row.created_at ? str(row.created_at) : null,
    }
})

/** Favourite product ids of the user, newest first. */
export const getFavoriteProductIds = cache(async (userId: number): Promise<number[]> => {
    const db = await getDB()
    const { results } = await db
        .prepare('SELECT product_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC, id DESC')
        .bind(userId)
        .all<Row>()
    return ((results || []) as Row[]).map((r: Row) => Number(r.product_id)).filter((n: number) => Number.isInteger(n) && n > 0)
})

export interface AccountOrderLine {
    productId: number | null
    name: string
    quantity: number
    /** Unit price the customer paid (already rounded by the order API). */
    unitPrice: number
}

export interface AccountOrder {
    id: number
    status: string
    paymentStatus: string
    totalAmount: number
    shippingCost: number | null
    createdAt: string | null
    lines: AccountOrderLine[]
    note: string
    city: string
    district: string
    fullName: string
    trackingNumber: string
    /** Carrier tracking URL saved by BirFatura (orders.tracking_code), when it is an http(s) URL. */
    trackingUrl: string | null
    shippingCompany: string
    invoiceUrl: string | null
    invoiceNo: string
}

function parseJson(value: unknown): unknown {
    if (typeof value !== 'string' || !value) return value ?? null
    try {
        return JSON.parse(value)
    } catch {
        return null
    }
}

function httpUrl(value: unknown): string | null {
    const s = str(value).trim()
    return /^https?:\/\//i.test(s) ? s : null
}

/** Orders of the user (by user id or by the e-mail used at checkout), newest first, with their lines. */
export async function getAccountOrders(user: Pick<AccountUser, 'id' | 'email'>): Promise<AccountOrder[]> {
    const db = await getDB()
    const email = user.email || '\u0000'
    const [ordersRes, linesRes] = await db.batch([
        db
            .prepare(
                `SELECT id, status, payment_status, total_amount, shipping_address, items, note, tracking_number, tracking_code,
                        shipping_company, invoice_url, invoice_no, created_at
                 FROM orders WHERE user_id = ? OR guest_email = ? ORDER BY created_at DESC, id DESC LIMIT 200`,
            )
            .bind(user.id, email),
        db
            .prepare(
                `SELECT oi.order_id, oi.product_id, oi.quantity, oi.price_at_purchase, oi.product_name
                 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                 WHERE o.user_id = ? OR o.guest_email = ? ORDER BY oi.id`,
            )
            .bind(user.id, email),
    ])

    const linesByOrder = new Map<number, AccountOrderLine[]>()
    for (const r of (linesRes.results || []) as Row[]) {
        const orderId = Number(r.order_id)
        const list = linesByOrder.get(orderId) ?? []
        list.push({
            productId: r.product_id === null || r.product_id === undefined ? null : Number(r.product_id),
            name: str(r.product_name) || 'Ürün',
            quantity: Number(r.quantity) || 1,
            unitPrice: Number(r.price_at_purchase) || 0,
        })
        linesByOrder.set(orderId, list)
    }

    return ((ordersRes.results || []) as Row[]).map(r => {
        const id = Number(r.id)
        const address = (parseJson(r.shipping_address) || {}) as Row
        let lines = linesByOrder.get(id) ?? []
        if (!lines.length) {
            // Very old orders may only have the JSON copy in orders.items (null when payment init failed)
            const json = parseJson(r.items)
            if (Array.isArray(json)) {
                lines = (json as Row[]).map(it => ({
                    productId: it.product_id ?? it.id ? Number(it.product_id ?? it.id) : null,
                    name: str(it.name) || 'Ürün',
                    quantity: Number(it.quantity) || 1,
                    unitPrice: Number(it.price) || 0,
                }))
            }
        }
        const shipping = Number(address.shipping_cost)
        return {
            id,
            status: str(r.status) || 'pending',
            paymentStatus: str(r.payment_status),
            totalAmount: Number(r.total_amount) || 0,
            shippingCost: Number.isFinite(shipping) && address.shipping_cost !== undefined && address.shipping_cost !== '' ? shipping : null,
            createdAt: r.created_at ? str(r.created_at) : null,
            lines,
            note: str(r.note) || str(address.note),
            city: str(address.city),
            district: str(address.district),
            fullName: str(address.fullName),
            trackingNumber: str(r.tracking_number).trim(),
            trackingUrl: httpUrl(r.tracking_code),
            shippingCompany: str(r.shipping_company).trim(),
            invoiceUrl: httpUrl(r.invoice_url),
            invoiceNo: str(r.invoice_no),
        }
    })
}

/** Number of orders (for the account overview), same rule as getAccountOrders. */
export async function countAccountOrders(user: Pick<AccountUser, 'id' | 'email'>): Promise<number> {
    const db = await getDB()
    const row = await db
        .prepare('SELECT COUNT(*) AS n FROM orders WHERE user_id = ? OR guest_email = ?')
        .bind(user.id, user.email || '\u0000')
        .first<Row>()
    return Number(row?.n) || 0
}
