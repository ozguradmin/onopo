import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Cache installment rates for 1 hour to avoid excessive API calls
let cachedRates: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in milliseconds

export async function GET() {
    try {
        // Check cache first
        if (cachedRates && (Date.now() - cacheTimestamp) < CACHE_DURATION) {
            return NextResponse.json(cachedRates, {
                headers: { 'Cache-Control': 'public, s-maxage=3600' }
            })
        }

        const db = await getDB()
        const settings = await db.prepare('SELECT merchant_id, api_key, merchant_salt FROM payment_settings LIMIT 1').first() as any

        if (!settings || !settings.merchant_id || !settings.api_key || !settings.merchant_salt) {
            return NextResponse.json({
                error: 'PayTR ayarları yapılandırılmamış. Lütfen Admin Panel > Ödeme Ayarları sayfasından Merchant ID, API Key ve Salt değerlerini girin.'
            }, { status: 400 })
        }

        const request_id = Date.now().toString()

        // PayTR token generation: base64(hmac_sha256(merchant_id + request_id + merchant_salt, merchant_key))
        const hashStr = settings.merchant_id + request_id + settings.merchant_salt
        const paytr_token = crypto
            .createHmac('sha256', settings.api_key)
            .update(hashStr)
            .digest('base64')

        // Call PayTR API
        const formData = new URLSearchParams()
        formData.append('merchant_id', settings.merchant_id)
        formData.append('request_id', request_id)
        formData.append('paytr_token', paytr_token)

        const response = await fetch('https://www.paytr.com/odeme/taksit-oranlari', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: formData.toString()
        })

        const result = await response.json()

        if (result.status === 'success') {
            // Cache the successful result
            cachedRates = result
            cacheTimestamp = Date.now()

            return NextResponse.json(result, {
                headers: { 'Cache-Control': 'public, s-maxage=3600' }
            })
        } else {
            console.error('PayTR installment rates error:', result)

            // If API is not authorized, return helpful message with fallback static rates
            // Common error: "Magaza API yetkisi bulunmuyor" (Store API authorization not found)
            const errorMsg = result.err_msg || ''

            if (errorMsg.includes('yetki') || errorMsg.includes('API')) {
                // Return fallback static rates with a note
                const fallbackRates = generateFallbackRates()
                return NextResponse.json({
                    ...fallbackRates,
                    status: 'success',
                    _note: 'Statik taksit oranları gösteriliyor. Gerçek oranlar için PayTR panelinden API yetkisi açılmalıdır.'
                }, {
                    headers: { 'Cache-Control': 'public, s-maxage=3600' }
                })
            }

            return NextResponse.json({ error: errorMsg || 'Taksit oranları alınamadı' }, { status: 500 })
        }
    } catch (error: any) {
        console.error('Installment rates API error:', error)

        // On any error, return fallback static rates
        const fallbackRates = generateFallbackRates()
        return NextResponse.json({
            ...fallbackRates,
            status: 'success',
            _note: 'Statik taksit oranları gösteriliyor.'
        }, {
            headers: { 'Cache-Control': 'public, s-maxage=3600' }
        })
    }
}

// Generate fallback static installment rates (general Turkish bank rates)
function generateFallbackRates() {
    const banks = ['bonus', 'world', 'maximum', 'axess', 'paraf', 'cardfinans', 'advantage']
    const result: any = {}

    banks.forEach(bank => {
        result[bank] = {
            taksit2: '1.89',
            taksit3: '2.89',
            taksit4: '3.89',
            taksit5: '4.89',
            taksit6: '5.89',
            taksit7: '6.89',
            taksit8: '7.89',
            taksit9: '8.89',
            taksit10: '9.89',
            taksit11: '10.89',
            taksit12: '11.89'
        }
    })

    return result
}
