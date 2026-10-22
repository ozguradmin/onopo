'use client'

import * as React from 'react'

// Only used when the daily cron has not stored a rate yet; never waited for longer than this
const LIVE_RATE_URL = 'https://api.exchangerate-api.com/v4/latest/USD'
const LIVE_RATE_TIMEOUT_MS = 3000

function positiveNumber(value: unknown): number {
    const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
    return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * USD → TRY rate for the "Dolar Bazlı Fiyat" helper of the product forms: 0 until it is known.
 * It never holds up the form. It reads the rate the daily price cron stored (site_settings.last_exchange_rate,
 * the same rate the cron multiplies USD prices with); only when none is stored does it ask the public
 * exchange-rate API, in the background and aborted after 3 s.
 */
export function useUsdTryRate(enabled: boolean = true): number {
    const [rate, setRate] = React.useState(0)

    React.useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined

        ;(async () => {
            try {
                // Admin view of the settings (private, no-store); includes last_exchange_rate
                const res = await fetch('/api/site-settings', { cache: 'no-store', signal: controller.signal })
                const stored = positiveNumber(res.ok ? (await res.json())?.last_exchange_rate : null)
                if (stored) {
                    setRate(stored)
                    return
                }
            } catch {
                if (controller.signal.aborted) return
            }

            timer = setTimeout(() => controller.abort(), LIVE_RATE_TIMEOUT_MS)
            try {
                const res = await fetch(LIVE_RATE_URL, { signal: controller.signal })
                const live = positiveNumber(res.ok ? (await res.json())?.rates?.TRY : null)
                if (live) setRate(live)
            } catch {
                // No rate: the USD helper stays hidden, the TL price can still be typed
            } finally {
                clearTimeout(timer)
            }
        })()

        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [enabled])

    return rate
}
