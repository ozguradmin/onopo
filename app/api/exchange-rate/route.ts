import { NextRequest, NextResponse } from 'next/server'

// Cache exchange rate for 1 hour
let cachedRate: { rate: number; timestamp: number } | null = null
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour in ms

export async function GET(req: NextRequest) {
    try {
        // Check cache
        if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_DURATION) {
            return NextResponse.json({
                success: true,
                rate: cachedRate.rate,
                source: 'cache',
                updated_at: new Date(cachedRate.timestamp).toISOString()
            })
        }

        // Fetch from free API (frankfurter.app is free and doesn't require API key)
        const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=TRY', {
            next: { revalidate: 3600 } // Cache at edge for 1 hour
        })

        if (!response.ok) {
            throw new Error('Exchange rate API failed')
        }

        const data = await response.json()
        const rate = data.rates?.TRY

        if (!rate) {
            throw new Error('TRY rate not found in response')
        }

        // Update cache
        cachedRate = {
            rate: rate,
            timestamp: Date.now()
        }

        return NextResponse.json({
            success: true,
            rate: rate,
            source: 'api',
            updated_at: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Exchange rate error:', error)

        // Return cached rate if available, even if expired
        if (cachedRate) {
            return NextResponse.json({
                success: true,
                rate: cachedRate.rate,
                source: 'stale_cache',
                updated_at: new Date(cachedRate.timestamp).toISOString()
            })
        }

        // Fallback rate (approximate)
        return NextResponse.json({
            success: true,
            rate: 32.50, // Fallback approximate rate
            source: 'fallback',
            updated_at: new Date().toISOString(),
            warning: 'Using fallback rate'
        })
    }
}
