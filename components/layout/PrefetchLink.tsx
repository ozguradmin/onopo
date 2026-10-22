'use client'

/**
 * next/link with a prefetch that suits this store. Every page is rendered per request and none has a loading.js, so
 * Next's automatic prefetch fetches nothing for them and each tap waited for the server. Here the router fetches the
 * whole page ahead (a full prefetch, kept staleTimes.static in the router cache, next.config.ts; worker.ts serves
 * these payloads from the edge cache), so the tap shows it at once:
 *   prefetchOn="view"    as soon as the link is on screen (the bottom nav's page tabs: few, and tapped all the time)
 *   prefetchOn="intent"  on hover (after 100 ms, so a mouse sweeping over a menu does not fetch every link), touch
 *                        start or focus (header, drawer and menu links)
 *   prefetchOn="none"    never (e.g. the tab of the page you are on)
 * Only for public pages (lib/prefetch.ts isPrefetchableHref: never account, orders, checkout, login or admin) and not
 * for visitors on Save-Data or a 2G-class connection; otherwise it is a plain Link without prefetch.
 */
import * as React from 'react'
import Link from 'next/link'
import { isPrefetchableHref, prefetchAllowedOn, type ConnectionHints } from '@/lib/prefetch'

const HOVER_DELAY_MS = 100

function noopSubscribe() {
    return () => { }
}

function connectionAllows(): boolean {
    return prefetchAllowedOn((navigator as Navigator & { connection?: ConnectionHints }).connection)
}

/** false on the server and during hydration, then what the connection allows. */
function useConnectionAllowsPrefetch(): boolean {
    return React.useSyncExternalStore(noopSubscribe, connectionAllows, () => false)
}

type LinkProps = Omit<React.ComponentProps<typeof Link>, 'prefetch'>

export function PrefetchLink({
    prefetchOn = 'intent',
    href,
    onMouseEnter,
    onMouseLeave,
    onTouchStart,
    onFocus,
    ...rest
}: LinkProps & { prefetchOn?: 'view' | 'intent' | 'none' }) {
    const allowed = useConnectionAllowsPrefetch()
    const eligible = allowed && prefetchOn !== 'none' && typeof href === 'string' && isPrefetchableHref(href)
    const [intent, setIntent] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    React.useEffect(() => () => clearTimeout(timer.current), [])
    const wake = eligible && prefetchOn === 'intent' && !intent

    return (
        <Link
            {...rest}
            href={href}
            prefetch={eligible && (prefetchOn === 'view' || intent)}
            onMouseEnter={e => {
                onMouseEnter?.(e)
                if (!wake) return
                clearTimeout(timer.current)
                timer.current = setTimeout(() => setIntent(true), HOVER_DELAY_MS)
            }}
            onMouseLeave={e => {
                onMouseLeave?.(e)
                clearTimeout(timer.current)
            }}
            onTouchStart={e => {
                onTouchStart?.(e)
                if (wake) setIntent(true)
            }}
            onFocus={e => {
                onFocus?.(e)
                if (wake) setIntent(true)
            }}
        />
    )
}
