'use client'

/**
 * Renders mini-markdown.ts tokens as React elements: text nodes, <strong>, lists and same-site <Link>s.
 * No dangerouslySetInnerHTML anywhere, so model text can never become markup. While a reply streams, a
 * "▍" caret follows the last character (static under reduced motion).
 */
import * as React from 'react'
import Link from 'next/link'
import { parseMiniMarkdown, type MdInline } from './mini-markdown'

function Inline({ tokens, onLink }: { tokens: MdInline[]; onLink?: () => void }) {
    return (
        <>
            {tokens.map((t, i) => {
                if (t.t === 'bold') return <strong key={i} className="font-semibold">{t.v}</strong>
                if (t.t === 'link') {
                    return (
                        <Link key={i} href={t.href} prefetch={false} onClick={onLink} className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700">
                            {t.v}
                        </Link>
                    )
                }
                return <React.Fragment key={i}>{t.v}</React.Fragment>
            })}
        </>
    )
}

const Caret = () => (
    <span aria-hidden="true" className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-ai-caret bg-ink/70 align-[-2px]" />
)

export function MiniMarkdown({ text, caret = false, onLink }: { text: string; caret?: boolean; onLink?: () => void }) {
    const blocks = React.useMemo(() => parseMiniMarkdown(text), [text])
    if (blocks.length === 0) return caret ? <p><Caret /></p> : null
    const last = blocks.length - 1
    return (
        <div className="space-y-2 text-[15px] leading-[23px] text-ink">
            {blocks.map((b, i) => {
                const tail = caret && i === last ? <Caret /> : null
                if (b.t === 'p') {
                    return (
                        <p key={i} className="break-words">
                            <Inline tokens={b.c} onLink={onLink} />
                            {tail}
                        </p>
                    )
                }
                const List = b.t === 'ul' ? 'ul' : 'ol'
                return (
                    <List key={i} className={b.t === 'ul' ? 'list-disc space-y-1 pl-5' : 'list-decimal space-y-1 pl-5'}>
                        {b.items.map((item, j) => (
                            <li key={j} className="break-words">
                                <Inline tokens={item} onLink={onLink} />
                                {j === b.items.length - 1 ? tail : null}
                            </li>
                        ))}
                    </List>
                )
            })}
        </div>
    )
}
