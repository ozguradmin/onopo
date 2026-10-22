'use client'

/**
 * The transcript (SPEC §10.6, §10.10): user bubbles on the right, assistant turns full width without a
 * bubble, in a fixed order: steps → text → cards (event order) → WhatsApp card → error row → follow-up chips.
 *
 * Why the typewriter: the server sends whole validated sentences, which would otherwise land in jumps. The
 * client reveals what it has with requestAnimationFrame, max(2, ceil(remaining / 8)) characters a frame, so
 * it always catches up within about 130 ms and never holds text back. Under reduced motion text appears at
 * once. Slow and stuck notices appear while a reply has no text yet (6 s, 15 s: SPEC LIMITS).
 */
import * as React from 'react'
import { LIMITS, whatsappLink, type Suggestion } from '@/lib/assistant/contract'
import { lastUserText, localWhatsapp, type CardEvent, type UiMessage } from '../chat-reducer'
import { MiniMarkdown } from '../MiniMarkdown'
import { useAssistantUi } from '../useAssistantChat'
import { Steps } from './Steps'
import { ProductCards } from './ProductCards'
import { CompareCard } from './CompareCard'
import { LinkCards } from './LinkCards'
import { StoreInfoCard } from './StoreInfoCard'
import { WhatsAppCard, WhatsAppRow } from './WhatsAppCard'
import { ErrorRow } from './ErrorRow'
import { ChipRow } from './EmptyState'

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    } catch {
        return false
    }
}

/** The part of `text` revealed so far; the whole text when not animating. */
function useReveal(text: string, animate: boolean): string {
    const [count, setCount] = React.useState(() => (animate ? 0 : text.length))
    const shown = React.useRef(count)

    React.useEffect(() => {
        if (!animate || prefersReducedMotion()) {
            shown.current = text.length
            setCount(text.length)
            return
        }
        let raf = 0
        const tick = () => {
            const remaining = text.length - shown.current
            if (remaining <= 0) return
            shown.current = Math.min(text.length, shown.current + Math.max(2, Math.ceil(remaining / 8)))
            setCount(shown.current)
            raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [text, animate])

    return animate ? text.slice(0, count) : text
}

/** 0 → 1 after slowNoticeMs → 2 after stuckNoticeMs, counted from the message's creation while it waits. */
function useWaitLevel(since: number, waiting: boolean): 0 | 1 | 2 {
    const [level, setLevel] = React.useState<0 | 1 | 2>(0)
    React.useEffect(() => {
        if (!waiting) {
            setLevel(0)
            return
        }
        const elapsed = Date.now() - since
        const timers = [
            setTimeout(() => setLevel(l => (l < 1 ? 1 : l)), Math.max(0, LIMITS.slowNoticeMs - elapsed)),
            setTimeout(() => setLevel(2), Math.max(0, LIMITS.stuckNoticeMs - elapsed)),
        ]
        return () => timers.forEach(clearTimeout)
    }, [since, waiting])
    return waiting ? level : 0
}

function Card({ card, stale }: { card: CardEvent; stale?: Record<number, 'price' | 'gone'> }) {
    switch (card.t) {
        case 'products':
            return <ProductCards card={card} stale={stale} />
        case 'compare':
            return <CompareCard card={card} />
        case 'links':
            return <LinkCards items={card.items} />
        case 'store_info':
            return <StoreInfoCard rows={card.rows} href={card.href} />
        default:
            return null
    }
}

function UserBubble({ m }: { m: UiMessage }) {
    return (
        <div className="flex">
            <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-3.5 py-2.5 text-[15px] leading-[22px] text-white">
                {m.text}
            </p>
        </div>
    )
}

function AssistantTurn({ m, isLast, restored, onChip }: { m: UiMessage; isLast: boolean; restored: boolean; onChip: (s: Suggestion) => void }) {
    const { chat, onNavigate } = useAssistantUi()
    const streaming = m.status === 'streaming'
    const text = useReveal(m.text, streaming)
    const wait = useWaitLevel(m.createdAt, streaming && !m.text)

    // A product from a restored chat is no longer sold: offer to find a similar one
    const gone = m.stale ? m.cards.flatMap(c => (c.t === 'products' || c.t === 'compare' ? c.products : [])).find(p => m.stale?.[p.id] === 'gone') : undefined
    const followUps: Suggestion[] = isLast && !streaming ? m.suggestions : []
    const stuckWa = wait === 2 && chat.waBase
        ? localWhatsapp({ reason: 'other', summary: lastUserText(chat.messages), waBase: chat.waBase, variant: 'compact' })
        : null

    return (
        <div aria-busy={streaming} className="min-w-0">
            {!m.local && <Steps steps={m.steps} streaming={streaming} />}
            {text && <MiniMarkdown text={text} caret={streaming} onLink={onNavigate} />}
            {wait >= 1 && <p className="mt-1 text-[13px] leading-5 text-muted">Biraz uzun sürüyor, hâlâ bakıyorum…</p>}
            {wait === 2 && (
                <div className="mt-2 space-y-2">
                    <button
                        type="button"
                        onClick={chat.stop}
                        className="inline-flex min-h-10 items-center text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                    >
                        Durdur
                    </button>
                    {stuckWa && (
                        <WhatsAppRow
                            href={whatsappLink(stuckWa.waBase, stuckWa.message)}
                            onClick={() => chat.beacon('wa_click', { reason: 'other' })}
                            label="Beklemek istemezsen WhatsApp'tan sor"
                        />
                    )}
                </div>
            )}
            {m.cards.map((c, i) => (
                <div key={i} className="mt-3">
                    <Card card={c} stale={m.stale} />
                </div>
            ))}
            {m.whatsapp && (
                <div className={m.local ? undefined : 'mt-3'}>
                    <WhatsAppCard card={m.whatsapp} beaconShown={!restored} />
                </div>
            )}
            {m.status === 'stopped' && (
                <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[13px] leading-5 text-muted">
                    Yanıt durduruldu.
                    {isLast && (
                        <button
                            type="button"
                            onClick={() => chat.retry(m.id)}
                            disabled={chat.streaming}
                            className="inline-flex min-h-10 items-center font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50"
                        >
                            Devam et
                        </button>
                    )}
                </p>
            )}
            {m.status === 'error' && m.error && (
                <div className="mt-3">
                    <ErrorRow message={m} isLast={isLast} />
                </div>
            )}
            {gone && isLast && !streaming && (
                <div className="mt-3">
                    <ChipRow chips={[{ label: 'Benzerini bul' }]} onChip={() => onChip({ label: `Benzerini bul: ${gone.name}` })} size="follow" />
                </div>
            )}
            {followUps.length > 0 && (
                <div className="mt-3">
                    <ChipRow chips={followUps} onChip={onChip} size="follow" />
                </div>
            )}
        </div>
    )
}

export function MessageList({ onChip }: { onChip: (s: Suggestion) => void }) {
    const { chat } = useAssistantUi()
    const messages = chat.messages
    return (
        <div role="log" aria-label="Sohbet" aria-relevant="additions" className="space-y-5">
            {messages.map((m, i) =>
                m.role === 'user' ? (
                    <UserBubble key={m.id} m={m} />
                ) : (
                    <AssistantTurn key={m.id} m={m} isLast={i === messages.length - 1} restored={chat.restoredIds.has(m.id)} onChip={onChip} />
                ),
            )}
        </div>
    )
}
