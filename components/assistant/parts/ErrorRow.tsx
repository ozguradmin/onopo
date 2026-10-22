'use client'

/**
 * What went wrong with a reply, in Turkish, with the one useful next step (SPEC §10.8): try again, start a
 * new chat, wait out a rate limit, or WhatsApp. Every row also offers the compact WhatsApp row, so a
 * visitor is never stuck (unless the store has no WhatsApp number, then no WhatsApp UI at all).
 */
import * as React from 'react'
import { RotateCcw } from 'lucide-react'
import { whatsappLink } from '@/lib/assistant/contract'
import { lastUserText, localWhatsapp, type UiMessage } from '../chat-reducer'
import { useAssistantUi } from '../useAssistantChat'
import { WhatsAppRow } from './WhatsAppCard'

function copy(m: UiMessage): string {
    const e = m.error!
    switch (e.code) {
        case 'rate_limited':
            return `Çok hızlı mesaj gönderdin. ${Math.max(1, Math.round(e.retryAfter ?? 10))} saniye sonra tekrar deneyebilirsin.`
        case 'conversation_limit':
            return 'Bu sohbet epey uzadı; yeni bir sohbet başlatabilir ya da WhatsApp\'tan yazabilirsin.'
        case 'off':
        case 'maintenance':
            return 'Asistan şu an kapalı. Sorunu WhatsApp\'tan iletebilirsin.'
        case 'busy':
            return 'Asistan şu an çok yoğun. Sorunu WhatsApp\'tan hemen iletebilirsin.'
        case 'timeout':
            return 'Yanıt çok uzun sürdü.'
        case 'too_long':
            return 'Mesajın çok uzun; biraz kısaltır mısın?'
        case 'network':
            if (m.text.trim()) return 'Bu yanıt yarım kaldı.'
            return 'Şu an yanıt veremiyorum. Bir daha deneyelim mi?'
        case 'offline':
            return 'İnternet bağlantın yok. Bağlanınca tekrar deneyebilirsin.'
        default:
            return 'Şu an yanıt veremiyorum. Bir daha deneyelim mi?'
    }
}

const RETRY = new Set(['timeout', 'upstream', 'network', 'bad_request', 'forbidden', 'offline'])

export function ErrorRow({ message, isLast }: { message: UiMessage; isLast: boolean }) {
    const { chat } = useAssistantUi()
    if (!message.error) return null
    const code = message.error.code
    // The compact row, unless this turn already shows a WhatsApp card (the server's or a local one)
    const compact = chat.waBase && !message.whatsapp
        ? localWhatsapp({ reason: 'other', summary: lastUserText(chat.messages), waBase: chat.waBase, variant: 'compact' })
        : null

    return (
        <div className="space-y-2">
            <p role="alert" className="text-[14px] leading-5 text-ink-2">{copy(message)}</p>
            {isLast && RETRY.has(code) && (
                <button
                    type="button"
                    onClick={() => chat.retry(message.id)}
                    disabled={chat.streaming}
                    className="inline-flex h-10 items-center gap-1.5 rounded-card border border-line px-3.5 text-[13px] font-semibold text-ink hover:border-line-strong disabled:opacity-50"
                >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Tekrar dene
                </button>
            )}
            {code === 'conversation_limit' && (
                <button
                    type="button"
                    onClick={chat.newChat}
                    className="inline-flex h-10 items-center rounded-card bg-brand-600 px-4 text-[13px] font-semibold text-white hover:bg-brand-700"
                >
                    Yeni sohbet
                </button>
            )}
            {compact && <WhatsAppRow href={whatsappLink(compact.waBase, compact.message)} onClick={() => chat.beacon('wa_click', { reason: 'other' })} />}
        </div>
    )
}
