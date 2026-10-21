import * as React from 'react'
import { Check } from 'lucide-react'
import type { DescriptionBlock, SpecRow } from './description-parser'

/**
 * Product description as structured text (server component). The stored HTML is parsed into plain
 * text blocks by description-parser.ts, so nothing from the database is injected as markup.
 */
export function ProductDescription({ tagline, blocks }: { tagline: string | null; blocks: DescriptionBlock[] }) {
    return (
        <div className="max-w-[68ch] text-[15px] leading-[26px] text-ink-2">
            {tagline && <p className="mb-3 text-base font-semibold leading-6 text-ink">{tagline}</p>}
            {blocks.map((b, i) => {
                if (b.type === 'h') {
                    return (
                        <h3 key={i} className="mb-2 mt-6 text-base font-semibold leading-6 text-ink first:mt-0">
                            {b.text}
                        </h3>
                    )
                }
                if (b.type === 'ul') {
                    return (
                        <ul key={i} className="my-4 flex flex-col gap-2.5">
                            {b.items.map((it, j) => (
                                <li key={j} className="flex gap-2.5">
                                    <span className="mt-[5px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                                        <Check className="h-3 w-3" strokeWidth={3} />
                                    </span>
                                    <span>
                                        {it.label && <strong className="font-semibold text-ink">{it.label}: </strong>}
                                        {it.text}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )
                }
                return (
                    <p key={i} className="mb-3 last:mb-0">
                        {b.text}
                    </p>
                )
            })}
        </div>
    )
}

/** Two-column definition list ("Marka · Onopo"). */
export function SpecsTable({ rows }: { rows: SpecRow[] }) {
    return (
        <dl className="overflow-hidden rounded-card border border-line text-sm leading-5">
            {rows.map((r, i) => (
                <div key={`${r.label}-${i}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-b border-line px-4 py-3 last:border-0 odd:bg-surface">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="break-words font-semibold text-ink">{r.value}</dd>
                </div>
            ))}
        </dl>
    )
}

export default ProductDescription
