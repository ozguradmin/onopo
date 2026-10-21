/**
 * Marks the parts of `text` that match the query tokens, with the same Turkish folding as lib/search
 * ("sarj" highlights "Şarj", "iphone" highlights "iPhone"). Tokens of 1–2 characters are only
 * highlighted at the start of a word, like the matcher.
 */
import * as React from 'react'
import { foldTr } from '@/lib/search'

function foldWithMap(text: string): { folded: string; map: number[] } {
    let folded = ''
    const map: number[] = []
    let i = 0
    for (const ch of text) {
        const f = foldTr(ch).replace(/[^a-z0-9]/g, ' ')
        for (let k = 0; k < f.length; k++) {
            folded += f[k]
            map.push(i)
        }
        i += ch.length
    }
    map.push(text.length)
    return { folded, map }
}

export function highlightRanges(text: string, tokens: string[]): Array<[number, number]> {
    if (!text || tokens.length === 0) return []
    const { folded, map } = foldWithMap(text)
    const ranges: Array<[number, number]> = []
    for (const token of tokens) {
        if (!token) continue
        let from = 0
        while (from <= folded.length - token.length) {
            const at = folded.indexOf(token, from)
            if (at < 0) break
            const wordStart = at === 0 || folded[at - 1] === ' '
            if (token.length >= 3 || wordStart) ranges.push([map[at], map[at + token.length]])
            from = at + 1
        }
    }
    ranges.sort((a, b) => a[0] - b[0])
    const merged: Array<[number, number]> = []
    for (const r of ranges) {
        const last = merged[merged.length - 1]
        if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1])
        else merged.push([r[0], r[1]])
    }
    return merged
}

export function Highlight({ text, tokens }: { text: string; tokens: string[] }) {
    const ranges = highlightRanges(text, tokens)
    if (ranges.length === 0) return <>{text}</>
    const parts: React.ReactNode[] = []
    let pos = 0
    ranges.forEach(([s, e], i) => {
        if (s > pos) parts.push(text.slice(pos, s))
        parts.push(
            <mark key={i} className="bg-transparent font-bold text-ink">
                {text.slice(s, e)}
            </mark>,
        )
        pos = e
    })
    if (pos < text.length) parts.push(text.slice(pos))
    return <>{parts}</>
}
