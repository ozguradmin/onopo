
export interface PaymentResult {
    status: 'success' | 'failure'
    htmlContent?: string
    iframeUrl?: string
    errorMessage?: string
    paymentId?: string
}

export interface PaymentProvider {
    initializePayment(order: any, user: any, basketItems: any[], remoteIp: string): Promise<PaymentResult>
}

export interface PaymentSettings {
    id: number
    provider: 'paytr' | 'iyzico' | 'offline'
    is_active: number
    api_key: string
    secret_key: string
    merchant_id: string
    base_url: string
}
