import * as React from 'react'
import Link from 'next/link'
import { Lightbulb } from 'lucide-react'
import { parseInlineLinks, type GuideBlock, type GuideFaq, type GuideSection } from '@/lib/guides'

/** Paragraph text with its [label](/path/) links (internal paths only, written in lib/guides/content). */
export function InlineText({ text }: { text: string }) {
    return (
        <>
            {parseInlineLinks(text).map((part, i) =>
                typeof part === 'string' ? (
                    <React.Fragment key={i}>{part}</React.Fragment>
                ) : (
                    <Link
                        key={i}
                        href={part.href}
                        prefetch={false}
                        className="font-semibold text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    >
                        {part.label}
                    </Link>
                ),
            )}
        </>
    )
}

function Block({ block }: { block: GuideBlock }) {
    switch (block.type) {
        case 'p':
            return (
                <p className="type-body mt-4 text-ink-2">
                    <InlineText text={block.text} />
                </p>
            )
        case 'ul':
        case 'ol': {
            const List = block.type
            return (
                <List className={`type-body mt-4 space-y-2 pl-5 text-ink-2 marker:text-brand-500 ${block.type === 'ol' ? 'list-decimal marker:font-semibold' : 'list-disc'}`}>
                    {block.items.map((item, i) => (
                        <li key={i} className="pl-1">
                            <InlineText text={item} />
                        </li>
                    ))}
                </List>
            )
        }
        case 'tip':
            return (
                <p className="mt-5 flex gap-3 rounded-card border border-brand-100 bg-brand-50 px-4 py-3 text-[15px] leading-6 text-ink-2">
                    <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />
                    <span>
                        <InlineText text={block.text} />
                    </span>
                </p>
            )
    }
}

/** The article: one H2 per section (anchors for the table of contents), then its blocks. */
export function GuideBody({ sections }: { sections: GuideSection[] }) {
    return (
        <div>
            {sections.map((section, i) => (
                <section key={section.id} aria-labelledby={section.id} className={i === 0 ? undefined : 'mt-10'}>
                    <h2 id={section.id} className="type-h2 scroll-mt-28 text-ink">
                        {section.heading}
                    </h2>
                    {section.blocks.map((block, j) => (
                        <Block key={j} block={block} />
                    ))}
                </section>
            ))}
        </div>
    )
}

/** Table of contents: links to the section anchors. */
export function GuideToc({ sections, faq, className }: { sections: GuideSection[]; faq: boolean; className?: string }) {
    return (
        <nav aria-label="İçindekiler" className={className}>
            <p className="type-micro text-muted">İçindekiler</p>
            <ol className="mt-2 space-y-1 text-sm">
                {sections.map(s => (
                    <li key={s.id}>
                        <a href={`#${s.id}`} className="inline-flex min-h-9 items-center text-ink-2 underline-offset-2 hover:text-brand-700 hover:underline">
                            {s.heading}
                        </a>
                    </li>
                ))}
                {faq && (
                    <li>
                        <a href="#sik-sorulan-sorular" className="inline-flex min-h-9 items-center text-ink-2 underline-offset-2 hover:text-brand-700 hover:underline">
                            Sık sorulan sorular
                        </a>
                    </li>
                )}
            </ol>
        </nav>
    )
}

/** The FAQ, always visible (the FAQPage JSON-LD carries exactly these questions). */
export function GuideFaqList({ items }: { items: GuideFaq[] }) {
    if (!items.length) return null
    return (
        <section aria-labelledby="sik-sorulan-sorular" className="mt-12">
            <h2 id="sik-sorulan-sorular" className="type-h2 scroll-mt-28 text-ink">
                Sık sorulan sorular
            </h2>
            <div className="mt-4 divide-y divide-line rounded-sheet border border-line">
                {items.map((item, i) => (
                    <div key={i} className="px-4 py-4 lg:px-5">
                        <h3 className="type-h3 text-ink">{item.q}</h3>
                        <p className="type-body mt-1.5 text-ink-2">
                            <InlineText text={item.a} />
                        </p>
                    </div>
                ))}
            </div>
        </section>
    )
}
