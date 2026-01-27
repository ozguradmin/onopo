import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

export const runtime = 'edge'

// Create Order (Public/User)
export async function POST(req: NextRequest) {
    try {
        const db = getDB()
        const body = await req.json()
        const { items, shippingAddress, guestEmail } = body

        // Auth check (Optional)
        const token = req.cookies.get('token')?.value
        let userId = null
        let userEmail = guestEmail

        if (token) {
            const payload = await verifyJWT(token)
            if (payload) {
                userId = payload.id
                userEmail = payload.email
            }
        }

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
        }
        if (!userEmail) {
            return NextResponse.json({ error: 'Email required' }, { status: 400 })
        }

        // Calculate Total & Verify Stock (Simplified)
        let totalAmount = 0
        const orderItems = []

        // In a real app, verify prices from DB. Trusting client for simulation speed.
        for (const item of items) {
            // Check stock?
            // const product = await db.prepare('SELECT price, stock FROM products WHERE id=?').bind(item.id).first()
            totalAmount += item.price * item.quantity
            orderItems.push({
                product_id: item.id,
                quantity: item.quantity,
                price: item.price,
                name: item.name // just for email context if needed
            })
        }

        // Create Order
        const orderResult = await db.prepare(
            `INSERT INTO orders (user_id, guest_email, status, total_amount, shipping_address) 
             VALUES (?, ?, ?, ?, ?) RETURNING id`
        ).bind(
            userId,
            userEmail,
            'pending',
            totalAmount,
            JSON.stringify(shippingAddress)
        ).first()

        // If RETURNING not supported (older D1), use last_insert_rowid()
        // But D1 supports it now mostly. If fails, handle it.
        // Let's assume valid ID.

        if (!orderResult) throw new Error("Order creation failed")

        const orderId = orderResult.id

        // Create Order Items
        const stmt = db.prepare(
            `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)`
        )
        const batch = orderItems.map(item => stmt.bind(orderId, item.product_id, item.quantity, item.price))
        await db.batch(batch)

        // Send Email
        const emailHtml = `
            <h1>Siparişiniz Alındı! 🎉</h1>
            <p>Merhaba,</p>
            <p>Siparişiniz başarıyla oluşturuldu. Sipariş numaranız: <strong>#${orderId}</strong></p>
            <p>Toplam Tutar: <strong>${totalAmount.toFixed(2)} ₺</strong></p>
            <hr />
            <h3>Ürünler:</h3>
            <ul>
                ${orderItems.map(i => `<li>${i.name} x ${i.quantity}</li>`).join('')}
            </ul>
            <p>Teşekkürler!</p>
        `

        // Fire and forget email? Cloudflare Workers handles async well but let's await to be safe or waitUntil
        // In Next.js Edge, we can await.
        await sendEmail({
            to: userEmail,
            subject: `Sipariş Onayı #${orderId}`,
            html: emailHtml
        })

        return NextResponse.json({ success: true, orderId })

    } catch (error: any) {
        console.error("Order error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Get Orders (Admin lists all, User lists theirs)
export async function GET(req: NextRequest) {
    try {
        const db = getDB()
        const token = req.cookies.get('token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        let query = 'SELECT * FROM orders ORDER BY created_at DESC'
        let bindArgs: any[] = []

        if (payload.role !== 'admin') {
            query = 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC'
            bindArgs = [payload.id]
        }

        const { results } = await db.prepare(query).bind(...bindArgs).all()

        return NextResponse.json(results)

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
