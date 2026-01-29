
import { PaymentProvider, PaymentResult, PaymentSettings } from './types'
// @ts-ignore
import Iyzipay from 'iyzipay'

export class IyzicoProvider implements PaymentProvider {
    private iyzipay: any

    constructor(private settings: PaymentSettings) {
        if (settings.api_key && settings.secret_key) {
            this.iyzipay = new Iyzipay({
                apiKey: settings.api_key,
                secretKey: settings.secret_key,
                uri: settings.base_url || 'https://sandbox-api.iyzipay.com'
            })
        }
    }

    async initializePayment(order: any, user: any, basketItems: any[], remoteIp: string): Promise<PaymentResult> {
        if (!this.iyzipay) {
            return { status: 'failure', errorMessage: 'Iyzico not configured' }
        }

        return new Promise((resolve) => {
            const request = {
                locale: Iyzipay.LOCALE.TR,
                conversationId: order.id.toString(),
                price: order.total.toString(),
                paidPrice: order.total.toString(),
                currency: Iyzipay.CURRENCY.TRY,
                basketId: order.id.toString(),
                paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
                callbackUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/payment/callback/iyzico/result`,
                enabledInstallments: [2, 3, 6, 9],
                buyer: {
                    id: user.id ? user.id.toString() : 'guest_' + Math.floor(Math.random() * 10000),
                    name: user.name.split(' ')[0] || 'Misafir',
                    surname: user.name.split(' ').slice(1).join(' ') || 'Kullanıcı',
                    gsmNumber: order.phone || '+905555555555',
                    email: user.email || 'guest@onopo.com',
                    identityNumber: '11111111111', // Dummy for guest, required by Iyzico
                    lastLoginDate: '2015-10-05 12:43:35', // Dummy
                    registrationAddress: order.address,
                    ip: remoteIp,
                    city: 'Istanbul',
                    country: 'Turkey',
                    zipCode: '34732'
                },
                shippingAddress: {
                    contactName: user.name,
                    city: 'Istanbul',
                    country: 'Turkey',
                    address: order.address,
                    zipCode: '34732'
                },
                billingAddress: {
                    contactName: user.name,
                    city: 'Istanbul',
                    country: 'Turkey',
                    address: order.address,
                    zipCode: '34732'
                },
                basketItems: basketItems.map(item => ({
                    id: item.id.toString(),
                    name: item.name,
                    category1: item.category || 'General',
                    itemType: Iyzipay.BASKET_ITEM_TYPE.PHYSICAL,
                    price: item.price.toString()
                }))
            }

            this.iyzipay.checkoutFormInitialize.create(request, (err: any, result: any) => {
                if (err) {
                    resolve({ status: 'failure', errorMessage: err.message })
                } else if (result.status !== 'success') {
                    resolve({ status: 'failure', errorMessage: result.errorMessage })
                } else {
                    resolve({
                        status: 'success',
                        htmlContent: result.checkoutFormContent
                    })
                }
            })
        })
    }
}
