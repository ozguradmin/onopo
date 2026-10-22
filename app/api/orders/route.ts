import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'
import { getDB } from '@/lib/db'
import * as pricing from '@/lib/pricing'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendAdminNewOrderNotification, sendOrderConfirmation } from '@/lib/email'

export const dynamic = 'force-dynamic'

const MAX_CART_LINES = 50
const MAX_QUANTITY_PER_ITEM = 100

// Cart item ids are "<productId>" or "<productId>-<variationId>-..." (see handleAddToCart in ProductClient)
function parseCartItemId(id: unknown): { productId: number, variationIds: number[] } | null {
    if (typeof id !== 'number' && typeof id !== 'string') return null
    const parts = String(id).split('-')
    if (!parts.every(part => /^[1-9]\d{0,14}$/.test(part))) return null
    const [productId, ...variationIds] = parts.map(Number)
    if (new Set(variationIds).size !== variationIds.length) return null
    return { productId, variationIds }
}

function isFilled(value: unknown): boolean {
    return typeof value === 'string' && value.trim() !== ''
}

// POST: Create new order (Guest or User)
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const body = parsed.body
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
        // Lenient on purpose (the checkout checks the exact Turkish format): a phone number has at least 10 digits
        if (String(customerInfo.phone).replace(/\D/g, '').length < 10) {
            return NextResponse.json({ error: 'Geçerli bir telefon numarası gir (örn. 0532\u00a0123\u00a045\u00a067)' }, { status: 400 })
        }
        if (!customerInfo?.fullName) {
            return NextResponse.json({ error: 'Ad soyad zorunlu' }, { status: 400 })
        }
        // BirFatura requires il and ilçe on every invoice
        if (!isFilled(customerInfo.city)) {
            return NextResponse.json({ error: 'Teslimat adresi için il zorunlu' }, { status: 400 })
        }
        if (!isFilled(customerInfo.district)) {
            return NextResponse.json({ error: 'Teslimat adresi için ilçe zorunlu' }, { status: 400 })
        }
        if (customerInfo.wantsDifferentBillingAddress) {
            if (!isFilled(customerInfo.billingCity)) {
                return NextResponse.json({ error: 'Fatura ili zorunlu' }, { status: 400 })
            }
            if (!isFilled(customerInfo.billingDistrict)) {
                return NextResponse.json({ error: 'Fatura ilçesi zorunlu' }, { status: 400 })
            }
            if (!isFilled(customerInfo.billingAddress)) {
                return NextResponse.json({ error: 'Fatura adresi zorunlu' }, { status: 400 })
            }
        }

        if (!Array.isArray(items) || items.length > MAX_CART_LINES) {
            return NextResponse.json({ error: 'Sepet geçersiz' }, { status: 400 })
        }

        // Only the product id, variation ids and quantity come from the client.
        // Price, name and free_shipping are read from D1 so a tampered request can't change the amount.
        const cartLines = []
        for (const item of items) {
            const parsed = parseCartItemId(item?.id)
            if (!parsed) {
                return NextResponse.json({ error: 'Sepette geçersiz bir ürün var' }, { status: 400 })
            }
            const quantity = item.quantity
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
                return NextResponse.json({ error: `Ürün adedi 1 ile ${MAX_QUANTITY_PER_ITEM} arasında olmalı` }, { status: 400 })
            }
            cartLines.push({ ...parsed, quantity })
        }

        const productStmt = db.prepare('SELECT id, name, price, free_shipping, is_active, stock FROM products WHERE id = ?')
        const variationStmt = db.prepare('SELECT id, product_id, name, value, price_modifier FROM product_variations WHERE id = ?')
        const productIds = [...new Set(cartLines.map(line => line.productId))]
        const variationIds = [...new Set(cartLines.flatMap(line => line.variationIds))]
        const lookups = await db.batch([
            ...productIds.map(id => productStmt.bind(id)),
            ...variationIds.map(id => variationStmt.bind(id))
        ])
        const productsById = new Map<number, any>()
        const variationsById = new Map<number, any>()
        lookups.forEach((result: any, i: number) => {
            const row = result.results?.[0]
            if (!row) return
            if (i < productIds.length) productsById.set(row.id, row)
            else variationsById.set(row.id, row)
        })

        // Calculate items total with rounded prices (lib/pricing.ts is the single source of truth;
        // the cart drawer and checkout use the same functions)
        let itemsTotal = 0
        let hasFreeShippingItem = false
        const orderItems = []

        for (const line of cartLines) {
            const product = productsById.get(line.productId)
            if (!product || Number(product.is_active) !== 1) {
                return NextResponse.json({ error: 'Sepetinizdeki bir ürün artık satışta değil. Lütfen sepetinizi güncelleyin.' }, { status: 400 })
            }

            // Stock is a manual in-stock flag (sales don't decrement it): 0 or less means not for sale.
            // Checked before the order and the PayTR token are created.
            if (!(Number(product.stock) > 0)) {
                return NextResponse.json({ error: `${product.name} stokta yok. Lütfen ürünü sepetinizden çıkarın.` }, { status: 400 })
            }

            // Same price the product page shows: base price + selected variation modifiers
            const priceModifiers = []
            const variantValues = []
            const variationGroups = new Set()
            for (const variationId of line.variationIds) {
                const variation = variationsById.get(variationId)
                if (!variation || variation.product_id !== product.id || variationGroups.has(variation.name)) {
                    return NextResponse.json({ error: 'Sepetinizdeki bir ürünün seçenekleri değişmiş. Lütfen ürünü sepetten çıkarıp yeniden ekleyin.' }, { status: 400 })
                }
                variationGroups.add(variation.name)
                priceModifiers.push(variation.price_modifier)
                variantValues.push(variation.value)
            }

            const rawPrice = pricing.rawUnitPrice(product.price, priceModifiers)
            const roundedPrice = pricing.unitPrice(rawPrice)
            if (roundedPrice <= 0) {
                return NextResponse.json({ error: 'Sepetinizdeki bir ürünün fiyatı geçersiz' }, { status: 400 })
            }

            itemsTotal += pricing.lineTotal(rawPrice, line.quantity)
            if (Number(product.free_shipping) === 1) hasFreeShippingItem = true
            orderItems.push({
                product_id: product.id,
                quantity: line.quantity,
                price: roundedPrice,
                name: variantValues.length > 0 ? `${product.name} (${variantValues.join(' / ')})` : product.name
            })
        }

        // Fetch shipping settings
        const shippingSettings = await db.prepare('SELECT free_shipping_threshold, shipping_cost FROM shipping_settings LIMIT 1').first()

        // Free shipping if:
        // 1. Any item has free_shipping (from the products table), OR
        // 2. Total is above the free shipping threshold
        const shippingCost = pricing.shippingCost(itemsTotal, hasFreeShippingItem, pricing.parseShippingSettings(shippingSettings))

        const totalAmount = pricing.orderTotal(itemsTotal, shippingCost)

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
            payment: paymentResult,
            // The exact amount of the order row (and of the PayTR payment), for the checkout's payment step
            totalAmount
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
