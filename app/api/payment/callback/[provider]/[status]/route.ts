
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import crypto from 'crypto'
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
                // Extract Order ID (removing random suffix)
                // Assuming merchant_oid is "ORDERID" + random
                // But wait, in PayTR impl we did: order.id + random
                // We need to store paymentId in order or parse it. 
                // Simple parsing if we know length? Or enable strict OID?
                // Let's assume we stored payment_id in a separate column or just assume Order ID is the prefix.
                // Actually, best practice: store merchant_oid in DB `payment_id` column.
                // For now, let's try to parse: PayTR sends back exactly what we sent.
                // Our format: `order_id` + random(6 digits).
                const orderId = merchant_oid.slice(0, -6)

                await db.prepare("UPDATE orders SET status = 'approved', payment_status = 'paid' WHERE id = ?").bind(orderId).run()
                return new NextResponse('OK')
            } else {
                const orderId = merchant_oid.slice(0, -6)
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
