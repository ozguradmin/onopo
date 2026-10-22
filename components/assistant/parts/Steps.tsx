'use client'

/**
 * What the assistant is doing right now (SPEC §10.6): one row per real server step (tool call), never a
 * scripted animation and never reasoning text. Active rows shimmer next to a small spinner, done rows get a
 * ✓ and their count. Before the first server event the row "Sorunu anlıyorum…" is shown optimistically.
 * Once the turn is done the rows fold into one quiet button ("✓ 12 ürün bulundu · Fiyatlar güncel").
 */
import * as React from 'react'
import { Check } from 'lucide-react'
import { stepLabel } from '@/lib/assistant/contract'
import type { UiStep } from '../chat-reducer'

function Row({ step }: { step: UiStep }) {
    const active = step.state === 'active'
    const label = stepLabel(step.id, step.state, step.n)
    if (!label) return null
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

export function Steps({ steps, streaming }: { steps: UiStep[]; streaming: boolean }) {
    const [expanded, setExpanded] = React.useState(false)

    if (streaming) {
        const shown = steps.length === 0
            ? [{ id: 'understand', state: 'active' } as UiStep]
            : steps.filter(s => s.state === 'active' || stepLabel(s.id, 'done', s.n) != null).slice(-4)
        if (shown.length === 0) return null
        return (
            <ul className="mb-2 space-y-1.5">
                {shown.map(s => <Row key={s.id} step={s} />)}
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
