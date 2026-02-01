import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Cron endpoint to update TL prices from USD based on exchange rate
// Should be called daily at 10:00 AM Turkey time (UTC 07:00)
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()

        // Optional: Verify cron secret for security
        const authHeader = req.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        // Allow without secret for manual testing, but log warning
        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            console.log('Warning: Cron endpoint called without valid secret')
        }

        // Fetch current USD/TRY exchange rate
        console.log('Fetching current exchange rate...')
        const rateRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD', {
            headers: { 'Accept': 'application/json' }
        })

        if (!rateRes.ok) {
            throw new Error(`Exchange rate API failed: ${rateRes.status}`)
        }

        const rateData = await rateRes.json()
        const usdToTry = rateData.rates?.TRY

        if (!usdToTry || typeof usdToTry !== 'number') {
            throw new Error('Invalid exchange rate data')
        }

        console.log(`Current USD/TRY rate: ${usdToTry}`)

        // Save the exchange rate to settings
        await db.prepare(
            `INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)`
        ).bind('last_exchange_rate', usdToTry.toString()).run()

        await db.prepare(
            `INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)`
        ).bind('last_exchange_update', new Date().toISOString()).run()

        // Get all products with USD price set
        const { results: products } = await db.prepare(
            `SELECT id, name, price_usd FROM products WHERE price_usd IS NOT NULL AND price_usd > 0`
        ).all()

        if (!products || products.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No products with USD price found',
                exchangeRate: usdToTry,
                updatedCount: 0
            })
        }

        console.log(`Updating ${products.length} products with USD prices...`)

        let updatedCount = 0
        for (const product of products as any[]) {
            const newTlPrice = Math.round(product.price_usd * usdToTry * 100) / 100 // Round to 2 decimals

            await db.prepare(
                `UPDATE products SET price = ? WHERE id = ?`
            ).bind(newTlPrice, product.id).run()

            console.log(`Updated ${product.name}: $${product.price_usd} -> ₺${newTlPrice}`)
            updatedCount++
        }

        return NextResponse.json({
            success: true,
            message: `Updated ${updatedCount} products`,
            exchangeRate: usdToTry,
            updatedCount,
            timestamp: new Date().toISOString()
        })

    } catch (error: any) {
        console.error('Price update error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
