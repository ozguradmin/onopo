import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { roundPrice } from '@/lib/roundPrice'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendAdminNewOrderNotification, sendOrderConfirmation } from '@/lib/email'

export const dynamic = 'force-dynamic'

// POST: Create new order (Guest or User)
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const body = await req.json()
        const { items, customerInfo } = body

        // Auth check (Optional - guest checkout allowed)
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        let userId = null

        if (token) {
            const payload = await verifyJWT(token)
            if (payload) {
                userId = payload.userId || payload.sub || payload.id
            }
        }

        // Validate required fields
        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'Sepet boş' }, { status: 400 })
        }
        if (!customerInfo?.email) {
            return NextResponse.json({ error: 'E-posta adresi zorunlu' }, { status: 400 })
        }
        if (!customerInfo?.phone) {
            return NextResponse.json({ error: 'Telefon numarası zorunlu' }, { status: 400 })
        }
        if (!customerInfo?.fullName) {
            return NextResponse.json({ error: 'Ad soyad zorunlu' }, { status: 400 })
        }

        // Calculate items total with rounded prices
        let itemsTotal = 0
        const orderItems = []

        for (const item of items) {
            const roundedPrice = roundPrice(item.price)
            itemsTotal += roundedPrice * item.quantity
            orderItems.push({
                product_id: item.id,
                quantity: item.quantity,
                price: roundedPrice,
                name: item.name
            })
        }

        // Fetch shipping settings
        const shippingSettings = await db.prepare('SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1').first()
        const freeThreshold = shippingSettings ? parseFloat(shippingSettings.free_shipping_threshold) : 500.00
        const shippingCostDef = shippingSettings ? parseFloat(shippingSettings.shipping_cost) : 100.00

        let shippingCost = 0

        // Check if ANY item has free_shipping flag - if so, entire order is free shipping
        const hasFreeShippingItem = items.some((item: any) => item.free_shipping === true)

        // Free shipping if:
        // 1. Any item has free_shipping: true, OR
        // 2. Total is above the free shipping threshold
        if (!hasFreeShippingItem && itemsTotal < freeThreshold) {
            shippingCost = shippingCostDef
        }

        const totalAmount = itemsTotal + shippingCost

        // Get Payment Settings EARLY to store provider in shipping_address
        const settings = await db.prepare('SELECT * FROM payment_settings WHERE is_active = 1 LIMIT 1').first() as any

        // Create order
        const shippingAddress = JSON.stringify({
            fullName: customerInfo.fullName,
            phone: customerInfo.phone,
            address: customerInfo.address || '',
            city: customerInfo.city || '',
            district: customerInfo.district || '',
            postalCode: customerInfo.postalCode || '',
            note: customerInfo.note || '',
            // Invoice/Billing fields
            tcIdentity: customerInfo.tcIdentity || '',
            wantsDifferentBillingAddress: customerInfo.wantsDifferentBillingAddress || false,
            billingAddress: customerInfo.billingAddress || '',
            billingCity: customerInfo.billingCity || '',
            billingDistrict: customerInfo.billingDistrict || '',
            provider: settings?.provider || 'offline', // Store provider for filtering in Admin Panel
            shipping_cost: shippingCost // Record shipping cost
        })

        const orderResult = await db.prepare(
            `INSERT INTO orders (user_id, guest_email, status, total_amount, shipping_address, payment_status, note) 
             VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`
        ).bind(
            userId,
            customerInfo.email,
            'pending',
            totalAmount,
            shippingAddress,
            'pending',
            customerInfo.note || ''
        ).first()

        if (!orderResult) throw new Error("Sipariş oluşturulamadı")

        const orderId = orderResult.id

        // Create order items
        const stmt = db.prepare(
            `INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase, product_name) VALUES (?, ?, ?, ?, ?)`
        )
        const batch = orderItems.map(item => stmt.bind(orderId, item.product_id, item.quantity, item.price, item.name))
        await db.batch(batch)

        // PAYMENT INTEGRATION
        let paymentResult = { status: 'success', paymentId: 'offline', iframeUrl: undefined as string | undefined, htmlContent: undefined as string | undefined }

        if (settings && settings.provider !== 'offline') {
            try {
                let provider = null

                if (settings.provider === 'paytr') {
                    const { PaytrProvider } = require('@/lib/payment/paytr')
                    provider = new PaytrProvider(settings)
                } else if (settings.provider === 'iyzico') {
                    const { IyzicoProvider } = require('@/lib/payment/iyzico')
                    provider = new IyzicoProvider(settings)
                }

                if (provider) {
                    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1'
                    const userForPayment = {
                        id: userId,
                        email: customerInfo.email,
                        name: customerInfo.fullName
                    }
                    const orderForPayment = {
                        id: orderId,
                        total: totalAmount,
                        address: customerInfo.address,
                        phone: customerInfo.phone
                    }

                    const result = await provider.initializePayment(orderForPayment, userForPayment, orderItems, ip)
                    if (result.status === 'failure') {
                        throw new Error(result.errorMessage || 'Ödeme sağlayıcı hatası')
                    }
                    paymentResult = { ...paymentResult, ...result }
                }
            } catch (err: any) {
                // Cancel order if payment init failed
                await db.prepare('UPDATE orders SET status = ?, payment_status = ? WHERE id = ?').bind('cancelled', 'failed', orderId).run()
                return NextResponse.json({ error: 'Ödeme başlatılamadı: ' + err.message }, { status: 400 })
            }
        }

        // Store items in order for later retrieval (as JSON)
        await db.prepare('UPDATE orders SET items = ? WHERE id = ?').bind(JSON.stringify(orderItems), orderId).run()

        // Send emails (awaited)
        // ONLY send now if payment is already complete (offline or direct).
        // For PayTR (iframe), email will be sent in callback.
        if (paymentResult.status === 'success' && !paymentResult.iframeUrl) {
            try {
                // Send customer confirmation email
                await sendOrderConfirmation({ id: orderId, total_amount: totalAmount }, orderItems, customerInfo.email)

                // Send admin notification
                const adminEmailSetting = await db.prepare("SELECT value FROM site_settings WHERE key = 'admin_email'").first() as any
                if (adminEmailSetting?.value) {
                    await sendAdminNewOrderNotification({ id: orderId, total_amount: totalAmount }, orderItems, customerInfo.email, adminEmailSetting.value)
                }
            } catch (emailErr) {
                console.error('Email sending failed:', emailErr)
                // Don't fail order for email issues
            }
        }

        return NextResponse.json({
            success: true,
            orderId,
            message: 'Siparişiniz başarıyla oluşturuldu!',
            payment: paymentResult
        })

    } catch (error: any) {
        console.error("Order error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// Get Orders - For admin panel 
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        // Return empty array if not authenticated
        if (!token) {
            return NextResponse.json([])
        }

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json([])
        }

        const userId = payload.userId || payload.sub || payload.id
        const userRole = payload.role

        let query = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 200'
        let bindArgs: any[] = []

        // Non-admin users can only see their own orders
        if (userRole !== 'admin') {
            query = 'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50'
            bindArgs = [userId]
        }

        const { results } = bindArgs.length > 0
            ? await db.prepare(query).bind(...bindArgs).all()
            : await db.prepare(query).all()

        // Filter out pending/failed PayTR/online orders for Admin
        // User requested to hide failed attempts.
        const filteredResults = (results || []).filter((order: any) => {
            if (userRole !== 'admin') return true // Users see their own orders

            try {
                // If payment is paid, always show
                if (order.payment_status === 'paid' || order.status === 'approved') return true

                // Parse shipping address to get provider
                const addr = JSON.parse(order.shipping_address || '{}')
                const provider = addr.provider

                // If provider is offline (Havale/Kapıda Ödeme), show even if pending
                if (provider === 'offline' || !provider) return true

                // If online payment (paytr/iyzico) and NOT paid -> Hide
                // This hides failed PayTR attempts
                if ((provider === 'paytr' || provider === 'iyzico') && order.payment_status !== 'paid') {
                    return false
                }

                return true
            } catch (e) {
                return true // Show on error
            }
        })

        return NextResponse.json(filteredResults)

    } catch (error: any) {
        console.error('Orders fetch error:', error)
        return NextResponse.json([])
    }
}
