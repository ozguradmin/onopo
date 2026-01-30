import { PaymentProvider, PaymentResult, PaymentSettings } from './types'
import crypto from 'crypto'

export class PaytrProvider implements PaymentProvider {
    constructor(private settings: PaymentSettings) { }

    async initializePayment(order: any, user: any, basketItems: any[], remoteIp: string): Promise<PaymentResult> {
        try {
            const { merchant_id, merchant_key, merchant_salt } = this.getCredentials()

            // Validate credentials
            if (!merchant_id || !merchant_key || !merchant_salt) {
                console.error('PayTR Credentials Check:', {
                    merchant_id: merchant_id ? 'SET' : 'MISSING',
                    merchant_key: merchant_key ? 'SET' : 'MISSING',
                    merchant_salt: merchant_salt ? 'SET' : 'MISSING'
                })
                return { status: 'failure', errorMessage: 'PayTR credentials missing' }
            }

            // Prepare basket - format: [[name, price, qty], [name, price, qty], ...]
            const basketArray = basketItems.map(item => [
                item.name || 'Ürün',
                (item.price || 0).toFixed(2),
                item.quantity || 1
            ])
            const user_basket = Buffer.from(JSON.stringify(basketArray)).toString('base64')

            // Unique merchant order ID
            const merchant_oid = `${order.id}_${Date.now()}`

            // Payment amount in kuruş (cents) - integer
            const payment_amount = Math.round(order.total * 100).toString()

            // Other parameters
            const no_installment = '0' // 0 = taksit var, 1 = taksit yok
            const max_installment = '0' // 0 = limit yok
            const currency = 'TL'
            const test_mode = '1' // Test mode - change to '0' for production

            // User info
            const email = user.email || 'test@test.com'
            const user_name = user.name || 'Misafir'
            const user_address = order.address || 'Adres belirtilmemiş'
            const user_phone = order.phone || '5555555555'

            // Get proper IP - Cloudflare passes IPv6, we need a valid IP
            let user_ip = remoteIp || '127.0.0.1'
            // If it's an IPv6 address with ::, simplify it or use a fallback
            if (user_ip.includes('::')) {
                // Keep it as is - PayTR should accept IPv6
            }

            // URLs
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://onopostore.com'
            const merchant_ok_url = `${baseUrl}/siparis-basarili`
            const merchant_fail_url = `${baseUrl}/siparis-hata`

            // CRITICAL: Token generation - exact format from PayTR docs
            // hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
            const hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode

            // paytr_token = base64_encode(hash_hmac('sha256', hash_str + merchant_salt, merchant_key, true))
            const paytr_token = crypto
                .createHmac('sha256', merchant_key)
                .update(hash_str + merchant_salt)
                .digest('base64')

            // Prepare form data
            const formData = new URLSearchParams()
            formData.append('merchant_id', merchant_id)
            formData.append('user_ip', user_ip)
            formData.append('merchant_oid', merchant_oid)
            formData.append('email', email)
            formData.append('payment_amount', payment_amount)
            formData.append('paytr_token', paytr_token)
            formData.append('user_basket', user_basket)
            formData.append('debug_on', '1')
            formData.append('no_installment', no_installment)
            formData.append('max_installment', max_installment)
            formData.append('user_name', user_name)
            formData.append('user_address', user_address)
            formData.append('user_phone', user_phone)
            formData.append('merchant_ok_url', merchant_ok_url)
            formData.append('merchant_fail_url', merchant_fail_url)
            formData.append('timeout_limit', '30')
            formData.append('currency', currency)
            formData.append('test_mode', test_mode)

            console.log('PayTR Request Debug:', {
                merchant_id,
                user_ip,
                merchant_oid,
                email,
                payment_amount,
                user_basket: user_basket.substring(0, 50) + '...',
                no_installment,
                max_installment,
                currency,
                test_mode,
                paytr_token: paytr_token.substring(0, 20) + '...'
            })

            const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData.toString()
            })

            const data = await res.json()
            console.log('PayTR Response:', data)

            if (data.status === 'success') {
                return {
                    status: 'success',
                    iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
                    paymentId: merchant_oid
                }
            } else {
                return { status: 'failure', errorMessage: data.reason || 'PayTR token generation failed' }
            }

        } catch (error: any) {
            console.error('PayTR Error:', error)
            return { status: 'failure', errorMessage: error.message }
        }
    }

    private getCredentials() {
        // merchant_id = merchant_id
        // api_key = merchant_key (PayTR's merchant password)
        // merchant_salt = merchant_salt (PayTR's secret salt)
        return {
            merchant_id: this.settings.merchant_id || '',
            merchant_key: this.settings.api_key || '',
            merchant_salt: (this.settings as any).merchant_salt || this.settings.secret_key || ''
        }
    }
}
