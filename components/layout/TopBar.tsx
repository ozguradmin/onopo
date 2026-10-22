"use client"

/**
 * Announcement bar above the header (static, not sticky).
 * Desktop (≥1024): 36px ink bar, all messages on one line + phone and help links on the right.
 * Mobile: 32px, one message at a time (CSS-only rotation, static under reduced motion).
 * Messages are built from data (free-shipping threshold, max installments, return window) unless the
 * admin set site_settings.topbar_messages.
 */
import * as React from "react"
import Link from "next/link"
import { Phone } from "lucide-react"
import { useSiteSettings } from "@/components/layout/store-data"
import { useAnnouncements } from "@/components/layout/trust"
import { telHref } from "@/components/layout/nav-data"

export function TopBar() {
    const settings = useSiteSettings()
    const messages = useAnnouncements()
    if (messages.length === 0) return null
    const count = Math.min(messages.length, 4)

    // Its own landmark: the announcements and help links are not loose content outside every region
    return (
        <aside aria-label="Duyurular" className="bg-ink text-white">
            {/* Mobile: rotating single line */}
            <div className="lg:hidden">
                <div
                    className="topbar-rotator relative mx-auto h-8 max-w-[480px] overflow-hidden px-4 text-center text-[12.5px] font-medium leading-8"
                    data-count={count > 1 ? count : undefined}
                    style={{ ['--topbar-count' as string]: count }}
                >
                    {messages.slice(0, 4).map((m, i) => (
                        <p
                            key={m.key}
                            data-msg=""
                            className="absolute inset-0 flex items-center justify-center gap-1.5 truncate px-4"
                            style={count > 1 ? { animationDelay: `${i * 4}s` } : undefined}
                        >
                            {m.icon && <m.icon className="h-3.5 w-3.5 shrink-0 text-brand-100" aria-hidden="true" />}
                            <span className="truncate">{m.text}</span>
                        </p>
                    ))}
                </div>
            </div>

            {/* Desktop: everything on one line */}
            <div className="container-store hidden h-9 items-center justify-between gap-6 text-[13px] font-medium lg:flex">
                <ul className="flex min-w-0 items-center gap-5 text-white/90">
                    {messages.map((m, i) => (
                        <li key={m.key} className="flex min-w-0 items-center gap-1.5 whitespace-nowrap">
                            {i > 0 && <span className="mr-3.5 h-1 w-1 rounded-full bg-white/30" aria-hidden="true" />}
                            {m.icon && <m.icon className="h-4 w-4 shrink-0 text-brand-100" aria-hidden="true" strokeWidth={1.75} />}
                            <span className="truncate">{m.text}</span>
                        </li>
                    ))}
                </ul>
                <div className="flex shrink-0 items-center gap-5 text-white/75">
                    {settings.footer_phone && (
                        <a href={telHref(settings.footer_phone)} className="inline-flex items-center gap-1.5 transition-colors hover:text-white">
                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="tabular-nums">{settings.footer_phone}</span>
                        </a>
                    )}
                    <Link href="/orders/" prefetch={false} className="transition-colors hover:text-white">
                        Sipariş takibi
                    </Link>
                    <Link href="/page/help/" prefetch={false} className="transition-colors hover:text-white">
                        Yardım
                    </Link>
                </div>
            </div>
        </aside>
    )
}
