
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import crypto from 'crypto'
import { sendOrderConfirmation, sendAdminNewOrderNotification } from '@/lib/email'
// @ts-ignore
import Iyzipay from 'iyzipay'

// Callback handler for /api/payment/callback/[provider]/[status]
// e.g., /api/payment/callback/paytr/success
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string, status?: string }> }) {
    try {
        const { provider, status: pathStatus } = await params
        const db = await getDB()
        const settings = await db.prepare('SELECT * FROM payment_settings WHERE provider = ? AND is_active = 1 LIMIT 1').bind(provider).first() as any

        if (!settings) return NextResponse.json({ error: 'Provider not active' }, { status: 400 })

        if (provider === 'paytr') {
            const formData = await req.formData()
            const merchant_oid = formData.get('merchant_oid') as string
            const status = formData.get('status') as string
            const total_amount = formData.get('total_amount') as string
            const hash = formData.get('hash') as string

            if (!merchant_oid || !hash) return new NextResponse('FAIL')

            // PayTR Hash Validation
            const { merchant_key, merchant_salt } = { merchant_key: settings.api_key, merchant_salt: settings.secret_key }
            const params = `${merchant_oid}${settings.merchant_salt}${status}${total_amount}`
            const calculatedHash = crypto.createHmac('sha256', merchant_key).update(params).digest('base64')

            if (hash !== calculatedHash) return new NextResponse('FAIL') // Hash mismatch

            if (status === 'success') {
                // Determine Order ID
                // Format: SP{ID}T{TIMESTAMP} or just {ID} + random
                let orderId = merchant_oid
                if (merchant_oid.startsWith('SP') && merchant_oid.includes('T')) {
                    orderId = merchant_oid.split('T')[0].substring(2)
                } else if (merchant_oid.length > 6) {
                    // Fallback to old logic just in case: slice last 6
                    // But if new format is used, this else if might be skipped
                    // Better to check if it matches existing ID
                }

                // Update Order Status
                await db.prepare("UPDATE orders SET status = 'approved', payment_status = 'paid' WHERE id = ?").bind(orderId).run()

                // Send Emails (Awaited)
                try {
                    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(orderId).first() as any
                    if (order) {
                        const orderItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
                        const customerEmail = order.guest_email

                        // Send User Email
                        await sendOrderConfirmation({ id: order.id, total_amount: order.total_amount }, orderItems, customerEmail)

                        // Send Admin Email
                        const siteSettings = await db.prepare('SELECT admin_email FROM site_settings LIMIT 1').first() as any
                        if (siteSettings?.admin_email) {
                            await sendAdminNewOrderNotification({ id: order.id, total_amount: order.total_amount }, orderItems, customerEmail, siteSettings.admin_email)
                        }
                    }
                } catch (e) {
                    console.error('Callback email error:', e)
                }

                return new NextResponse('OK')
            } else {
                // Payment Failed
                let orderId = merchant_oid
                if (merchant_oid.startsWith('SP') && merchant_oid.includes('T')) {
                    orderId = merchant_oid.split('T')[0].substring(2)
                }
                await db.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ?").bind(orderId).run()
                return new NextResponse('OK')
            }
        }
        else if (provider === 'iyzico') {
            // Iyzico sends token in body or callback logic.
            // Actually, for Checkout Form, Iyzico posts to callbackUrl.
            // req body contains `token`.
            const body = await req.formData() // Iyzico usually posts form data
            const token = body.get('token') as string
            if (!token) return NextResponse.redirect(new URL('/payment/fail?reason=no_token', req.url))

            const iyzipay = new Iyzipay({
                apiKey: settings.api_key,
                secretKey: settings.secret_key,
                uri: settings.base_url || 'https://sandbox-api.iyzipay.com'
            })

            return new Promise((resolve) => {
                iyzipay.checkoutForm.retrieve({ token }, async (err: any, result: any) => {
                    if (err || result.status !== 'success') {
                        resolve(NextResponse.redirect(new URL('/payment/fail', req.url)))
                    } else if (result.paymentStatus === 'SUCCESS') {
                        const orderId = result.basketId
                        await db.prepare("UPDATE orders SET status = 'approved', payment_status = 'paid' WHERE id = ?").bind(orderId).run()
                        resolve(NextResponse.redirect(new URL(`/order-confirmation/${orderId}`, req.url)))
                    } else {
                        resolve(NextResponse.redirect(new URL('/payment/fail', req.url)))
                    }
                })
            })
        }

        return NextResponse.json({ error: 'Unknown provider' }, { status: 400 })

    } catch (error: any) {
        console.error('Payment callback error', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
