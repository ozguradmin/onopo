
import { PaymentProvider, PaymentResult, PaymentSettings } from './types'
import crypto from 'crypto'

export class PaytrProvider implements PaymentProvider {
    constructor(private settings: PaymentSettings) { }

    async initializePayment(order: any, user: any, basketItems: any[], remoteIp: string): Promise<PaymentResult> {
        try {
            const { merchant_id, merchant_key, merchant_salt } = this.getCredentials()

            // Validate credentials
            if (!merchant_id || !merchant_key || !merchant_salt) {
                return { status: 'failure', errorMessage: 'PayTR credentials missing' }
            }

            const basket = basketItems.map(item => [item.name, item.price.toString(), item.quantity])
            const user_basket = Buffer.from(JSON.stringify(basket)).toString('base64')
            const merchant_oid = order.id.toString() + Math.floor(Math.random() * 999999).toString() // Unique ID
            const payment_amount = Math.round(order.total * 100) // Kuruş
            const no_installment = 0 // Taksit yapılsın mı? 0: Evet, 1: Hayır
            const max_installment = 0 // Max taksit sayısı (0: limit yok)
            const currency = 'TL'

            // URLs - Adjust these to your domain
            const merchant_ok_url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payment/callback/paytr/success`
            const merchant_fail_url = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payment/callback/paytr/fail`

            const email = user.email || 'test@test.com'
            // Fields needed for token:
            // merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
            const test_mode = '1' // 1 for test, 0 for prod (Maybe add to settings?)

            const rawString = `${merchant_id}${remoteIp}${merchant_oid}${email}${payment_amount}${user_basket}${no_installment}${max_installment}${currency}${test_mode}`

            const token = crypto.createHmac('sha256', merchant_key + merchant_salt).update(rawString).digest('base64')

            const params = new URLSearchParams()
            params.append('merchant_id', merchant_id)
            params.append('user_ip', remoteIp)
            params.append('merchant_oid', merchant_oid)
            params.append('email', email)
            params.append('payment_amount', payment_amount.toString())
            params.append('paytr_token', token)
            params.append('user_basket', user_basket)
            params.append('debug_on', '1')
            params.append('no_installment', no_installment.toString())
            params.append('max_installment', max_installment.toString())
            params.append('user_name', user.name || 'Misafir Kullanıcı')
            params.append('user_address', order.address || 'Adres yok')
            params.append('user_phone', order.phone || '5555555555')
            params.append('merchant_ok_url', merchant_ok_url)
            params.append('merchant_fail_url', merchant_fail_url)
            params.append('timeout_limit', '30')
            params.append('currency', currency)
            params.append('test_mode', test_mode)

            const res = await fetch('https://www.paytr.com/odeme/api/get-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params
            })

            const data = await res.json()

            if (data.status === 'success') {
                return {
                    status: 'success',
                    iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
                    paymentId: merchant_oid // Store this temporarily or in order
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
        return {
            merchant_id: this.settings.merchant_id,
            merchant_key: this.settings.api_key, // Mapping api_key to merchant_key
            merchant_salt: this.settings.secret_key // Mapping secret_key to merchant_salt
        }
    }
}
