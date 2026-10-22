import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

const EMAIL_ONLY_FIELDS = ['id', 'status', 'payment_status', 'payment_method', 'total_amount', 'items', 'created_at', 'updated_at']

function emailOnlyOrder(order: any) {
    const summary: Record<string, unknown> = { details_hidden: true }
    for (const key of EMAIL_ONLY_FIELDS) if (key in order) summary[key] = order[key]
    let shippingCost: unknown
    try {
        shippingCost = JSON.parse(order.shipping_address || '{}')?.shipping_cost
    } catch {}
    summary.shipping_address = JSON.stringify(shippingCost === undefined ? {} : { shipping_cost: shippingCost })
    return summary
}

// GET: Get current user's orders
export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const db = await getDB()

        // Get userId with fallback (different JWT implementations may use different field names)
        const userId = payload.userId || payload.sub || payload.id

        if (!userId) {
            return NextResponse.json({ error: 'User ID not found in token' }, { status: 401 })
        }

        // Get orders for this user, both by user_id and by guest_email
        const userResult = await db.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first() as any
        const userEmail = userResult?.email

        // Query orders by user_id OR guest_email
        let orders: any[] = []

        if (userEmail) {
            const result = await db.prepare(`
                SELECT * FROM orders 
                WHERE user_id = ? OR guest_email = ? 
                ORDER BY created_at DESC
            `).bind(userId, userEmail).all()
            orders = result.results || []
        } else {
            const result = await db.prepare(`
                SELECT * FROM orders 
                WHERE user_id = ? 
                ORDER BY created_at DESC
            `).bind(userId).all()
            orders = result.results || []
        }

        // Orders matched only by the (unverified) e-mail keep their summary; personal and document data
        // is dropped, as on the /orders page (lib/account.ts getAccountOrders).
        orders = orders.map(o => (Number(o.user_id) === Number(userId) ? o : emailOnlyOrder(o)))

        return NextResponse.json({ orders })
    } catch (error: any) {
        console.error('Error fetching user orders:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
