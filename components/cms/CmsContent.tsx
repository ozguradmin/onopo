import * as React from 'react'
import { foldTr, slugifyTr } from '@/lib/seo'

/**
 * Renders the text of a CMS page (Admin › Sayfalar). The admin writes plain text with a few
 * markdown-like conventions; everything is rendered as React text (HTML in the content is escaped,
 * exactly as before), so no admin input can inject markup or scripts.
 *
 *   # Title            → skipped when it repeats the page title (the page H1), otherwise an H2
 *   ## Heading         → H2 (with an id for deep links)      ### Heading → H3
 *   - item / * item    → bullet list                         1. item     → numbered list
 *   **bold**           → <strong>
 *   e-mail, phone, https:// URLs → links (mailto:, tel:, new tab)
 *   "Label: value" on its own line → label in bold
 * Blocks are separated by a blank line; single line breaks inside a paragraph are kept.
 */

const INLINE =
    /(\*\*[^*\n]+\*\*)|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])|((?:\+90|0)[\s-]?\(?[2-5]\d{2}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2})/gi

const LINK_CLASS = 'font-semibold text-brand-600 underline decoration-brand-100 underline-offset-[3px] hover:text-brand-700 hover:decoration-brand-600'

function telHref(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    const national = digits.startsWith('90') ? digits.slice(2) : digits.replace(/^0/, '')
    return `tel:+90${national}`
}

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const out: React.ReactNode[] = []
    let last = 0
    let i = 0
    for (const m of text.matchAll(INLINE)) {
        const start = m.index ?? 0
        if (start > last) out.push(text.slice(last, start))
        const key = `${keyPrefix}-${i++}`
        const [match, bold, email, url, phone] = m
        if (bold) {
            out.push(
                <strong key={key} className="font-semibold text-ink">
                    {bold.slice(2, -2)}
                </strong>,
            )
        } else if (email) {
            out.push(
                <a key={key} href={`mailto:${email}`} className={LINK_CLASS}>
                    {email}
                </a>,
            )
        } else if (url) {
            out.push(
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                    {url.replace(/^https?:\/\//, '')}
                </a>,
            )
        } else if (phone) {
            out.push(
                <a key={key} href={telHref(phone)} className={cnWhitespace(LINK_CLASS)}>
                    {phone}
                </a>,
            )
        } else {
            out.push(match)
        }
        last = start + match.length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
}

function cnWhitespace(cls: string): string {
    return `${cls} whitespace-nowrap`
}

/** One line; "Label: value" gets a bold label when the label is short. */
function renderLine(line: string, key: string): React.ReactNode {
    const m = /^([A-Za-zÇĞİÖŞÜçğıöşü][A-Za-zÇĞİÖŞÜçğıöşü .]{1,28}):\s+(.+)$/.exec(line)
    if (m && !/https?$/i.test(m[1])) {
        return (
            <React.Fragment key={key}>
                <strong className="font-semibold text-ink">{m[1]}:</strong> {renderInline(m[2], key)}
            </React.Fragment>
        )
    }
    return <React.Fragment key={key}>{renderInline(line, key)}</React.Fragment>
}

type Block =
    | { type: 'h2' | 'h3'; text: string }
    | { type: 'ul' | 'ol'; items: string[] }
    | { type: 'p'; lines: string[] }

const BULLET = /^\s*[-*•]\s+/
const NUMBERED = /^\s*\d+[.)]\s+/

function parse(content: string, pageTitle: string): Block[] {
    const blocks: Block[] = []
    const chunks = content.replace(/\r\n?/g, '\n').split(/\n\s*\n/)
    const titleKey = foldTr(pageTitle).trim()

    for (const chunk of chunks) {
        let lines = chunk.split('\n').map(l => l.trimEnd()).filter(l => l.trim() !== '')
        while (lines.length) {
            const heading = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(lines[0])
            if (heading) {
                const level = heading[1].length
                const text = heading[2].trim()
                if (!(level === 1 && foldTr(text).trim() === titleKey)) {
                    blocks.push({ type: level <= 2 ? 'h2' : 'h3', text })
                }
                lines = lines.slice(1)
                continue
            }
            if (lines.every(l => BULLET.test(l))) {
                blocks.push({ type: 'ul', items: lines.map(l => l.replace(BULLET, '').trim()).filter(Boolean) })
            } else if (lines.every(l => NUMBERED.test(l))) {
                blocks.push({ type: 'ol', items: lines.map(l => l.replace(NUMBERED, '').trim()).filter(Boolean) })
            } else {
                blocks.push({ type: 'p', lines: lines.map(l => l.trim()) })
            }
            break
        }
    }
    return blocks
}

export function CmsContent({ content, title }: { content: string; title: string }) {
    const blocks = parse(content, title)
    const usedIds = new Map<string, number>()
    const idFor = (text: string) => {
        const base = slugifyTr(text) || 'bolum'
        const n = usedIds.get(base) ?? 0
        usedIds.set(base, n + 1)
        return n ? `${base}-${n + 1}` : base
    }

    return (
        <div className="text-[15px] leading-[26px] text-ink-2 lg:text-base lg:leading-7">
            {blocks.map((block, i) => {
                const key = `b${i}`
                switch (block.type) {
                    case 'h2':
                        return (
                            <h2 key={key} id={idFor(block.text)} className="mt-9 scroll-mt-28 text-lg font-bold leading-7 text-ink first:mt-0 lg:text-xl">
                                {renderInline(block.text, key)}
                            </h2>
                        )
                    case 'h3':
                        return (
                            <h3 key={key} className="mt-6 text-base font-semibold leading-6 text-ink first:mt-0">
                                {renderInline(block.text, key)}
                            </h3>
                        )
                    case 'ul':
                        return (
                            <ul key={key} className="mt-3 space-y-2 first:mt-0">
                                {block.items.map((item, j) => (
                                    <li key={j} className="relative pl-5 before:absolute before:left-1 before:top-[11px] before:h-1.5 before:w-1.5 before:rounded-full before:bg-brand-500 lg:before:top-3">
                                        {renderInline(item, `${key}-${j}`)}
                                    </li>
                                ))}
                            </ul>
                        )
                    case 'ol':
                        return (
                            <ol key={key} className="mt-3 list-decimal space-y-2 pl-6 marker:font-semibold marker:text-brand-600 first:mt-0">
                                {block.items.map((item, j) => (
                                    <li key={j} className="pl-1">
                                        {renderInline(item, `${key}-${j}`)}
                                    </li>
                                ))}
                            </ol>
                        )
                    default:
                        return (
                            <p key={key} className="mt-3 first:mt-0">
                                {block.lines.map((line, j) => (
                                    <React.Fragment key={j}>
                                        {j > 0 && <br />}
                                        {renderLine(line, `${key}-${j}`)}
                                    </React.Fragment>
                                ))}
                            </p>
                        )
                }
            })}
        </div>
    )
}
