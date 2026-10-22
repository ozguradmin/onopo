/**
 * Onopo Asistan: the tiny markdown subset the assistant may use (SPEC §9.1 "Üslup", §10.6): **bold**,
 * "- " bullets, "1. " numbered lists and [text](/internal-path) links. Pure tokenizer; MiniMarkdown.tsx
 * renders the tokens as React text nodes, so nothing the model writes can ever become HTML ("<img onerror>"
 * stays literal text).
 *
 * Why own code: a full markdown library would be most of the chat chunk, the subset is all the prompt
 * allows, and the text streams in, so an unclosed "**" at the end of a chunk must simply mean "bold until
 * the end" instead of breaking. Links render only for same-site paths; anything else shows its label only.
 */

export type MdInline =
    | { t: 'text'; v: string }
    | { t: 'bold'; v: string }
    | { t: 'link'; v: string; href: string }

export type MdBlock =
    | { t: 'p'; c: MdInline[] }
    | { t: 'ul'; items: MdInline[][] }
    | { t: 'ol'; items: MdInline[][] }

const LINK = /^\[([^\]\n]{1,200})\]\(([^)\s]{1,300})\)/
const BULLET = /^\s*[-•]\s+(.*)$/
const NUMBERED = /^\s*\d{1,2}[.)]\s+(.*)$/

/** A same-site path ("/kategori/kablo/", "/products/?q=a"): no scheme, no "//host", no backslash. */
export function isInternalHref(href: string): boolean {
    return /^\/(?![/\\])[A-Za-z0-9\-._~%/?=&#+,]*$/.test(href)
}

export function parseInline(s: string): MdInline[] {
    const out: MdInline[] = []
    let buf = ''
    let bold = false
    const flush = () => {
        if (!buf) return
        const prev = out[out.length - 1]
        const t = bold ? 'bold' : 'text'
        if (prev && prev.t === t) prev.v += buf
        else out.push({ t, v: buf })
        buf = ''
    }
    let i = 0
    while (i < s.length) {
        if (s[i] === '*' && s[i + 1] === '*') {
            flush()
            bold = !bold
            i += 2
            continue
        }
        if (s[i] === '[') {
            const m = LINK.exec(s.slice(i))
            if (m) {
                if (isInternalHref(m[2])) {
                    flush()
                    out.push({ t: 'link', v: m[1], href: m[2] })
                } else {
                    buf += m[1] // external or odd target: the label only, never the URL
                }
                i += m[0].length
                continue
            }
        }
        buf += s[i]
        i += 1
    }
    flush() // an unclosed ** leaves `bold` on: the rest was emitted as bold
    return out
}

export function parseMiniMarkdown(text: string): MdBlock[] {
    const blocks: MdBlock[] = []
    for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
        const line = raw.trimEnd()
        if (!line.trim()) continue
        const last = blocks[blocks.length - 1]
        const bullet = BULLET.exec(line)
        if (bullet) {
            const item = parseInline(bullet[1])
            if (last && last.t === 'ul') last.items.push(item)
            else blocks.push({ t: 'ul', items: [item] })
            continue
        }
        const numbered = NUMBERED.exec(line)
        if (numbered) {
            const item = parseInline(numbered[1])
            if (last && last.t === 'ol') last.items.push(item)
            else blocks.push({ t: 'ol', items: [item] })
            continue
        }
        blocks.push({ t: 'p', c: parseInline(line.trim()) })
    }
    return blocks
}
