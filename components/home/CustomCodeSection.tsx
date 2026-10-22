'use client'

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import {
    Award,
    Check,
    CircleCheck,
    Clock,
    CreditCard,
    Flame,
    Gem,
    Gift,
    Headset,
    Heart,
    Lock,
    Mail,
    MapPin,
    MessageCircle,
    Package,
    Percent,
    Phone,
    RotateCcw,
    ShieldCheck,
    Sparkles,
    Star,
    Tag,
    ThumbsUp,
    Truck,
    Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/** Font Awesome icon names (without "fa-") that have a lucide look-alike. */
const FA_ICONS: Record<string, LucideIcon> = {
    truck: Truck,
    'truck-fast': Truck,
    'truck-moving': Truck,
    'shipping-fast': Truck,
    'shield-halved': ShieldCheck,
    'shield-alt': ShieldCheck,
    shield: ShieldCheck,
    'shield-check': ShieldCheck,
    lock: Lock,
    'arrow-rotate-left': RotateCcw,
    'rotate-left': RotateCcw,
    undo: RotateCcw,
    'undo-alt': RotateCcw,
    'arrow-left-rotate': RotateCcw,
    bolt: Zap,
    'bolt-lightning': Zap,
    gem: Gem,
    'credit-card': CreditCard,
    headset: Headset,
    phone: Phone,
    'phone-alt': Phone,
    star: Star,
    gift: Gift,
    check: Check,
    'circle-check': CircleCheck,
    'check-circle': CircleCheck,
    tag: Tag,
    tags: Tag,
    percent: Percent,
    clock: Clock,
    box: Package,
    'box-open': Package,
    heart: Heart,
    fire: Flame,
    'fire-flame-curved': Flame,
    whatsapp: MessageCircle,
    comment: MessageCircle,
    'location-dot': MapPin,
    'map-marker-alt': MapPin,
    envelope: Mail,
    'thumbs-up': ThumbsUp,
    award: Award,
    'wand-magic-sparkles': Sparkles,
    'star-of-life': Sparkles,
}

/** Style and modifier classes that are not icon names. */
const FA_MODIFIERS = /^fa-(solid|regular|light|thin|duotone|brands|sharp|fw|xs|sm|lg|xl|2xl|\dx|10x|spin|spin-pulse|spin-reverse|pulse|beat|beat-fade|fade|bounce|shake|flip|flip-horizontal|flip-vertical|flip-both|rotate-\d+|rotate-by|border|pull-left|pull-right|inverse|li|stack|stack-\dx|ul)$/

function faIconName(className: string): string | null {
    for (const token of className.split(/\s+/)) {
        if (token.startsWith('fa-') && !FA_MODIFIERS.test(token)) return token.slice(3)
    }
    return null
}

const FA_STYLESHEET = /font-?awesome/i

/**
 * Admin "Özel HTML/CSS/JS" section, rendered in the browser only (spec §8.6): the server HTML holds
 * an empty, isolated container, so malformed admin HTML can never break the page markup or
 * hydration. Font Awesome <i> icons are swapped for inline lucide SVGs, and when every icon could be
 * swapped the Font Awesome stylesheet (≈190 KB with its font) is not loaded at all. Animations pause
 * while hovered or focused.
 *
 * Trust: this is NOT a sanitizer. <script> elements are dropped (as with the old innerHTML rendering),
 * but everything else the admin wrote runs on the live page with the store's origin: inline event
 * handlers (onerror, onload, onclick…), javascript: links, iframes and forms. That is acceptable only
 * because just admins can save this content; treat it like code the admin deploys.
 */
export function CustomCodeSection({ html, className }: { html: string; className?: string }) {
    const hostRef = React.useRef<HTMLDivElement>(null)
    const bankRef = React.useRef<HTMLDivElement>(null)
    const [mounted, setMounted] = React.useState(false)

    // Icon names the admin HTML uses that we can draw (rendered once, hidden, then cloned)
    const iconNames = React.useMemo(() => {
        const names = new Set<string>()
        for (const m of html.matchAll(/class\s*=\s*["']([^"']*\bfa-[^"']*)["']/gi)) {
            const name = faIconName(m[1])
            if (name && FA_ICONS[name]) names.add(name)
        }
        return [...names]
    }, [html])

    React.useEffect(() => {
        setMounted(true)
    }, [])

    React.useEffect(() => {
        const host = hostRef.current
        if (!mounted || !host) return
        try {
            const tpl = document.createElement('template')
            tpl.innerHTML = html
            const frag = tpl.content
            // Admin <script> elements are not run (same as the previous innerHTML rendering); inline
            // handlers and javascript: URLs in the rest of the markup still are, see above
            frag.querySelectorAll('script').forEach(s => s.remove())

            const iconEls = Array.from(frag.querySelectorAll<HTMLElement>('i[class*="fa-"], span[class*="fa-"]'))
            let allSwapped = true
            for (const el of iconEls) {
                const name = faIconName(el.getAttribute('class') || '')
                if (!name) continue
                const svg = bankRef.current?.querySelector(`svg[data-fa-icon="${name}"]`)
                if (!svg) {
                    allSwapped = false
                    continue
                }
                const clone = svg.cloneNode(true) as SVGElement
                clone.removeAttribute('data-fa-icon')
                clone.setAttribute('width', '1em')
                clone.setAttribute('height', '1em')
                clone.style.verticalAlign = '-0.125em'
                el.textContent = ''
                el.appendChild(clone)
                el.setAttribute('aria-hidden', 'true')
                el.style.display = 'inline-flex'
                el.style.alignItems = 'center'
                el.style.fontStyle = 'normal'
            }
            if (allSwapped) {
                frag.querySelectorAll('link[rel~="stylesheet"]').forEach(l => {
                    if (FA_STYLESHEET.test(l.getAttribute('href') || '')) l.remove()
                })
            }
            host.replaceChildren(frag)
        } catch (err) {
            console.error('[home] custom section could not be rendered:', err)
        }
        return () => {
            host.replaceChildren()
        }
    }, [mounted, html])

    return (
        <>
            {mounted && iconNames.length > 0 && (
                <div ref={bankRef} hidden aria-hidden="true">
                    {iconNames.map(name => {
                        const Icon = FA_ICONS[name]
                        return <Icon key={name} data-fa-icon={name} aria-hidden="true" />
                    })}
                </div>
            )}
            <div
                ref={hostRef}
                className={cn('custom-code-section relative isolate overflow-hidden [&:focus-within_*]:[animation-play-state:paused] [&:hover_*]:[animation-play-state:paused]', className)}
            />
        </>
    )
}

export default CustomCodeSection
