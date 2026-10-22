'use client'

/**
 * What the assistant is doing right now (SPEC §10.6): one row per real server step (tool call), never a
 * scripted animation and never reasoning text. Active rows shimmer next to a small spinner, done rows get a
 * ✓ and their count. Before the first server event the row "Sorunu anlıyorum…" is shown optimistically, and
 * while no step is active and no answer text has arrived yet (the model is writing) "Yanıtı hazırlıyorum…"
 * stands in, so the bubble is never empty while the visitor waits.
 * Once the turn is done the rows fold into one quiet button ("✓ 12 ürün bulundu · Fiyatlar güncel").
 */
import * as React from 'react'
import { Check } from 'lucide-react'
import { stepLabel } from '@/lib/assistant/contract'
import type { UiStep } from '../chat-reducer'

const WRITING_LABEL = 'Yanıtı hazırlıyorum…'

function RowView({ label, active }: { label: string; active: boolean }) {
    return (
        <li className="flex items-center gap-2 text-[13px] leading-5">
            {active ? (
                <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            ) : (
                <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-success" strokeWidth={3} />
            )}
            <span className={active ? 'ai-shimmer font-medium' : 'text-muted'}>{label}</span>
        </li>
    )
}

function Row({ step }: { step: UiStep }) {
    const label = stepLabel(step.id, step.state, step.n)
    if (!label) return null
    return <RowView label={label} active={step.state === 'active'} />
}

export function Steps({ steps, streaming, hasText = false }: { steps: UiStep[]; streaming: boolean; hasText?: boolean }) {
    const [expanded, setExpanded] = React.useState(false)

    if (streaming) {
        const shown = steps.length === 0
            ? [{ id: 'understand', state: 'active' } as UiStep]
            : steps.filter(s => s.state === 'active' || stepLabel(s.id, 'done', s.n) != null).slice(-4)
        const writing = !hasText && !shown.some(s => s.state === 'active' && stepLabel(s.id, 'active', s.n) != null)
        if (shown.length === 0 && !writing) return null
        return (
            <ul className="mb-2 space-y-1.5" aria-live="polite">
                {shown.map(s => <Row key={s.id} step={s} />)}
                {writing && <RowView label={WRITING_LABEL} active />}
            </ul>
        )
    }

    const done = steps.filter(s => s.state === 'done' && stepLabel(s.id, 'done', s.n) != null)
    if (done.length === 0) return null
    return (
        <div className="mb-2">
            <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded(v => !v)}
                className="inline-flex min-h-6 items-center gap-1 text-left text-xs text-muted hover:text-ink-2"
            >
                <Check aria-hidden="true" className="h-3 w-3 shrink-0 text-success" strokeWidth={3} />
                {done.map(s => stepLabel(s.id, 'done', s.n)).join(' · ')}
            </button>
            {expanded && (
                <ul className="mt-1.5 space-y-1.5">
                    {done.map(s => <Row key={s.id} step={s} />)}
                </ul>
            )}
        </div>
    )
}
