'use client'

/**
 * WhatsApp hand-off (SPEC §10.7), the most important card: the store's team answers orders, returns and
 * anything the assistant cannot promise. The full card shows the exact message that will be sent and lets
 * the visitor edit it first; the compact row is a one-line reminder. The number is never printed: it only
 * exists inside `waBase` (https://wa.me/<digits>), built by the server or from the store settings.
 * Text the visitor edits is their own message and is not masked again.
 *
 * The message field exists only after "Düzenle" (before it the message is plain text, so there is nothing to
 * focus), and editing ends when the panel is minimised or closed: a field that keeps focus inside a hidden sheet
 * made iOS show its keyboard for this message when the visitor tapped the search box (components/layout/focus-rules.ts).
 * The edited text stays.
 */
import * as React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { LIMITS, whatsappLink } from '@/lib/assistant/contract'
import { WhatsAppGlyph } from '../icons'
import { useAssistantUi } from '../useAssistantChat'
import { assistantVisible, useAssistantStore } from '../assistant-store'
import type { WhatsappEvent } from '../chat-reducer'

export function WhatsAppCard({ card, beaconShown = true }: { card: WhatsappEvent; beaconShown?: boolean }) {
    const { chat } = useAssistantUi()
    const [message, setMessage] = React.useState(card.message)
    const [editingState, setEditing] = React.useState(false)
    const panelVisible = useAssistantStore(assistantVisible)
    // Only while the panel is on screen: a minimised sheet keeps no editable field
    const editing = editingState && panelVisible
    const [more, setMore] = React.useState(false)
    const fieldRef = React.useRef<HTMLTextAreaElement>(null)
    const href = whatsappLink(card.waBase, message)
    const long = message.split('\n').length > 6 || message.length > 260

    React.useEffect(() => {
        if (beaconShown) chat.beacon('wa_shown', { reason: card.reason })
        // once per card
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // The sheet was minimised or closed while editing: back to the plain text (a new "Düzenle" is needed)
    React.useEffect(() => {
        if (!panelVisible) setEditing(false)
    }, [panelVisible])

    React.useEffect(() => {
        if (editing) fieldRef.current?.focus()
    }, [editing])

    const onClick = () => chat.beacon('wa_click', { reason: card.reason })

    if (card.variant === 'compact') return <WhatsAppRow href={href} onClick={onClick} />

    return (
        <div className="rounded-card border border-whatsapp/25 bg-whatsapp-50 p-3.5">
            <div className="flex items-start gap-2.5">
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-whatsapp text-white">
                    <WhatsAppGlyph className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0">
                    <p className="text-[15px] font-bold leading-5 text-ink">WhatsApp&apos;tan devam et</p>
                    <p className="mt-0.5 text-[13px] leading-5 text-muted">Ekibimiz bu konuda sana oradan yardımcı olsun.</p>
                </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Gönderilecek mesaj</span>
                <button
                    type="button"
                    onClick={() => setEditing(!editing)}
                    aria-expanded={editing}
                    className="-my-2 inline-flex min-h-10 items-center px-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                >
                    {editing ? 'Tamam' : 'Düzenle'}
                </button>
            </div>
            {editing ? (
                <textarea
                    ref={fieldRef}
                    value={message}
                    maxLength={LIMITS.waMessageMaxChars}
                    rows={6}
                    aria-label="Gönderilecek mesaj"
                    onChange={e => setMessage(e.target.value)}
                    className="mt-1.5 w-full resize-none rounded-thumb border border-line bg-white p-2.5 text-base leading-6 text-ink outline-none focus:border-brand-600"
                />
            ) : (
                <div className="mt-1.5 rounded-thumb border border-line bg-white p-2.5 text-[13px] leading-5 text-ink-2">
                    <p className={long && !more ? 'line-clamp-6 whitespace-pre-line break-words' : 'whitespace-pre-line break-words'}>{message}</p>
                    {long && !more && (
                        <button type="button" onClick={() => setMore(true)} className="mt-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700">
                            devamı
                        </button>
                    )}
                </div>
            )}
            <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClick}
                className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-card bg-whatsapp text-[15px] font-bold text-white transition-colors hover:bg-[#0B6459]"
            >
                <WhatsAppGlyph className="h-5 w-5" />
                WhatsApp&apos;tan devam et
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <p className="mt-2 text-[11px] leading-4 text-muted">WhatsApp açılır; mesajı göndermeden önce değiştirebilirsin.</p>
        </div>
    )
}

/**
 * The compact row: a small WhatsApp pill. It sits under every answer since w7 (owner decision), so it is
 * deliberately quiet (no border, one line). Also used under error rows and the "stuck" notice with a label.
 */
export function WhatsAppRow({ href, onClick, label = "Ekibimize WhatsApp'tan sor" }: { href: string; onClick?: () => void; label?: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClick}
            className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-full bg-whatsapp-50 py-2 pl-3 pr-3.5 text-[13px] font-semibold leading-5 text-whatsapp transition-colors hover:bg-[#DCF1EB]"
        >
            <WhatsAppGlyph className="h-4 w-4 shrink-0" />
            <span className="min-w-0">{label}</span>
            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        </a>
    )
}
