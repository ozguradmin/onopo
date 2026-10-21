/**
 * Turns a stored product description into display blocks and a specs table (pure, isomorphic).
 *
 * Two formats exist in the catalogue:
 *  - Imported rows (most products): one <div> with glued sections
 *      "Ürün Açıklaması<short title>Detaylı Bilgi<body>Teknik Özellikler<Marka…Ürün Kodu…Barkod…Desi…Varyant[…]>"
 *    with HTML entities, "✅" bullet items and sentences glued without a space ("sunar.GaN").
 *  - Admin-written plain text with blank lines, emoji headings ("🔋 Öne Çıkan Özellikler") and
 *    "Etiket: açıklama" lines.
 *
 * Output is plain text only (rendered as React text nodes, never as HTML), so stored markup can never
 * inject anything into the page. The "Teknik Özellikler" tail becomes `specs` (Desi, an internal
 * shipping weight, is never shown; stock counts from the legacy "Varyant" list are dropped).
 */

export type DescriptionBlock =
    | { type: 'p'; text: string }
    | { type: 'h'; text: string }
    | { type: 'ul'; items: Array<{ label?: string; text: string }> }

export interface SpecRow {
    label: string
    value: string
}

export interface ParsedDescription {
    /** Short tagline from the imported "Ürün Açıklaması" part, when it is not just the product name. */
    tagline: string | null
    blocks: DescriptionBlock[]
    specs: SpecRow[]
}

const NAMED_ENTITIES: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ouml: 'ö', Ouml: 'Ö', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
    rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—',
    bull: '•', middot: '·', hellip: '…', euro: '€', copy: '©', reg: '®', trade: '™',
    le: '≤', ge: '≥', deg: '°', times: '×', rarr: '→', larr: '←', laquo: '«', raquo: '»',
    acirc: 'â', Acirc: 'Â', icirc: 'î', Icirc: 'Î', ucirc: 'û', Ucirc: 'Û', eacute: 'é', Eacute: 'É',
    scedil: 'ş', Scedil: 'Ş', gbreve: 'ğ', Gbreve: 'Ğ', inodot: 'ı', Idot: 'İ',
}

export function decodeEntities(s: string): string {
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
            return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
        }
        return NAMED_ENTITIES[body] ?? m
    })
}

/** HTML → text with line breaks for block elements; tags removed, entities decoded. */
export function htmlToText(html: string | null | undefined): string {
    if (!html) return ''
    return decodeEntities(
        String(html)
            .replace(/\r\n?/g, '\n')
            .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, ' ')
            .replace(/<\s*br\s*\/?>/gi, '\n')
            .replace(/<\s*li[^>]*>/gi, '\n• ')
            .replace(/<\s*\/\s*(p|div|li|ul|ol|h[1-6]|tr|table|section)\s*>/gi, '\n')
            .replace(/<\s*(p|div|ul|ol|h[1-6]|tr|table|section)(\s[^>]*)?>/gi, '\n')
            .replace(/<[^>]*>/g, ''),
    )
}

const fold = (s: string) =>
    s
        .replace(/İ/g, 'i').replace(/I/g, 'ı')
        .toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ç/g, 'c').replace(/ö/g, 'o').replace(/ü/g, 'u')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()

const collapse = (s: string) => s.replace(/[ \t\u00a0]+/g, ' ').trim()

// Pictographs used as decoration: astral emoji (🔋 📱), check marks, stars, sparkles, variation selectors.
// Arrows (➝ ➔ ⇒) carry meaning ("USB-A ➝ Type-C") and are normalised to "→" instead.
const EMOJI_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF\u2705\u2714\u2716\u2728\u2733\u2734\u2747\u274C\u2753-\u2757\u2763\u2764\u2B50\u2B55\uFE0F\u200D]/g
const LEADING_PICTOGRAPH_RE = /^\s*(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u26FF\u2728\u2B50])/
const ARROW_RE = /\s*[\u279D\u279C\u2794\u279E\u2799\u279B\u27A1\u21D2\u27F6]\s*/g
const BULLET_RE = /^\s*(?:[\u2705\u2714\u2713\u2611\u2022\u25AA\u25E6\u25CF\u27A4\u25BA\u25B6*]|-(?=\s))\s*/

function isNameEcho(line: string, name: string): boolean {
    const a = fold(line.replace(EMOJI_RE, ' '))
    const b = fold(name)
    if (!a || !b) return false
    const bare = (s: string) => s.replace(/^onopo /, '')
    return a === b || bare(a) === bare(b) || (a.length > 25 && (b.includes(a) || bare(b).includes(bare(a))))
}

/** "Yüksek Güç – 67W Turbo şarj …" / "Hızlı Veri Aktarımı: Şarj ederken …" → bold label + text. */
function splitLabel(text: string): { label?: string; text: string } {
    const m = text.match(/^([^.:–—]{2,48}?)\s*(?:[:–—]|\s-\s)\s+(.{3,})$/)
    if (m && !/\d\s*$/.test(m[1])) return { label: m[1].trim(), text: m[2].trim() }
    return { text }
}

/** Sentence boundaries glued without a space: "sunar.GaN" → "sunar. GaN" (not "3.4A"). */
function fixGluedSentences(s: string): string {
    return s
        .replace(/\.{2,}(?=\s|$)/g, '.')
        .replace(/([a-zçğıöşü0-9)%’'"])([.!?])([A-ZÇĞİÖŞÜ])/g, '$1$2 $3')
        // "gelir.100-240V" → "gelir. 100-240V" (a word, not a number like "5.0", before the period)
        .replace(/([a-zçğıöşü]{2,})\.(\d)/g, '$1. $2')
}

/**
 * Inline feature runs inside one paragraph: "… Öne çıkan özellikler: 120W Turbo: Hızlı şarj. Esnek
 * Kablo: 1 metre. Güvenli Şarj: …" → paragraph + heading + list with bold labels. Only when at least
 * three "Etiket: açıklama." items follow sentence boundaries, so spec dumps without sentence breaks
 * ("Güç modu: USB Çalışma gerilimi: 36V …") stay plain paragraphs.
 */
function labelRuns(text: string): DescriptionBlock[] | null {
    // The boundary is a lookbehind, so "Özellikler: 120W Turbo: …" yields both labels
    const re = /(?<=^|[.!?…]\s+|:\s+)([A-ZÇĞİÖŞÜ0-9][^.:!?\n]{1,40}?):\s+/g
    const hits: Array<{ start: number; end: number; label: string }> = []
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) {
        hits.push({ start: m.index, end: m.index + m[0].length, label: m[1].trim() })
    }
    if (hits.length < 3) return null
    const items: Array<{ label: string; text: string }> = []
    let heading: string | null = null
    hits.forEach((h, i) => {
        const value = text.slice(h.end, i + 1 < hits.length ? hits[i + 1].start : text.length).trim()
        if (!value && i === 0) heading = h.label
        else items.push({ label: h.label, text: value })
    })
    const last = items[items.length - 1]
    const good = items.filter(it => it.text && it.text.length <= 320 && (/[.!?…]$/.test(it.text) || it === last))
    if (good.length < 3 || good.length < items.length - 1) return null

    const blocks: DescriptionBlock[] = []
    const lead = text.slice(0, hits[0].start).trim()
    if (lead) blocks.push({ type: 'p', text: lead })
    if (heading) blocks.push({ type: 'h', text: heading })
    // The last item often carries the closing paragraph: keep its first sentence only
    let tail = ''
    const cut = last.text.search(/[.!?]\s+(?=[A-ZÇĞİÖŞÜ])/)
    if (cut > 15 && cut < last.text.length - 2) {
        tail = last.text.slice(cut + 1).trim()
        last.text = last.text.slice(0, cut + 1).trim()
    }
    blocks.push({ type: 'ul', items })
    if (tail) blocks.push({ type: 'p', text: tail })
    return blocks
}

function parseSpecs(tail: string): SpecRow[] {
    const text = collapse(tail.replace(/\n/g, ' '))
    if (!text) return []
    const parts = text.split(/(Marka|Ürün Kodu|Barkod|Desi|Varyant)/)
    const rows: SpecRow[] = []
    for (let i = 1; i < parts.length; i += 2) {
        const key = parts[i]
        const value = collapse(parts[i + 1] || '').replace(/^[:\s]+/, '')
        if (!value) continue
        if (key === 'Desi') continue // internal shipping weight
        if (key === 'Varyant') {
            const colors: string[] = []
            for (const m of value.matchAll(/\[\s*([^:\]]+):\s*([^\](]+?)\s*(?:\(\s*Stok:\s*(-?\d+)\s*\))?\s*\]/gi)) {
                const stock = m[3] === undefined ? 1 : parseInt(m[3], 10)
                if (stock > 0) colors.push(collapse(m[2]))
            }
            const kind = (value.match(/\[\s*([^:\]]+):/) || [])[1]
            if (colors.length && kind) rows.push({ label: `${collapse(kind)} seçenekleri`, value: Array.from(new Set(colors)).join(', ') })
            continue
        }
        if (/^0+$/.test(value)) continue
        rows.push({ label: key === 'Ürün Kodu' ? 'Ürün kodu' : key, value })
    }
    return rows
}

/**
 * Drops the product name repeated at the start of the first paragraph ("İphone 15 Uyumlu … Koruyucu
 * İphone 15 modeli ile …" → "İphone 15 modeli ile …"). The cut is made before a capitalised word, so
 * the remaining text still starts like a sentence.
 */
function stripNameEcho(text: string, name: string): string {
    const nameWords = new Set(fold(name).split(' ').filter(w => w && w !== 'onopo'))
    if (nameWords.size < 3) return text
    const words = text.split(/\s+/)
    let prefix = 0
    const seen = new Set<string>()
    for (const w of words) {
        const f = fold(w)
        if (f === '' || f.split(' ').every(part => nameWords.has(part) || part === 'onopo')) {
            prefix++
            f.split(' ').forEach(part => part && seen.add(part))
        } else break
    }
    if (prefix < 4 || seen.size < nameWords.size * 0.6 || prefix >= words.length) return text
    // Cut where the echo ends if a sentence starts there, else before the last capitalised word inside it
    // (1) where the first word repeats ("İphone 16 Pro Max … Koruyucu İphone 16 Pro Max modeliyle …")
    let cut = -1
    const firstWord = fold(words[0])
    for (let i = Math.min(prefix, words.length - 1); i >= 3; i--) if (fold(words[i]) === firstWord) { cut = i; break }
    // (2) right after the echo when a new sentence starts there. Otherwise the name is the subject of
    // the first sentence ("Onopo T67 … Kablosu, güçlü …") and the text is kept as it is.
    if (cut < 0 && /^[A-ZÇĞİÖŞÜ]/.test(words[prefix]) && !/[,;:]$/.test(words[prefix - 1])) cut = prefix
    if (cut < 0) return text
    const rest = words.slice(cut).join(' ').replace(/^[\s,.;:–—-]+/, '')
    return rest.length >= 40 ? rest : text
}

/** Breaks a wall of text (> 420 chars) into paragraphs of whole sentences (~260 chars each). */
function splitLongParagraph(text: string): string[] {
    if (text.length <= 420) return [text]
    // Split only at whitespace after . ! ? so no character is ever lost ("Maks.1.5A" stays intact)
    const sentences = text.split(/(?<=[.!?])\s+/)
    const out: string[] = []
    let cur = ''
    for (const raw of sentences) {
        const s = raw.trim()
        if (!s) continue
        // a fragment starting with a digit or lowercase letter continues the previous sentence
        if (cur && /^[a-zçğıöşü0-9(]/.test(s)) { cur = `${cur} ${s}`; continue }
        if (cur && cur.length >= 260) { out.push(cur); cur = s } else cur = cur ? `${cur} ${s}` : s
    }
    if (cur) out.push(cur)
    return out
}

/** Groups text lines into paragraphs, headings and bullet lists. */
function toBlocks(body: string, name: string): DescriptionBlock[] {
    const prepared = fixGluedSentences(body)
        .replace(ARROW_RE, ' → ')
        // "… şarj edin.- Esnek kablo …": a dash after a sentence end is a bullet
        .replace(/([.!?])\s*-\s+(?=[A-ZÇĞİÖŞÜ0-9])/g, '$1\n- ')
        .replace(/^\s*-\s+(?=[A-ZÇĞİÖŞÜ0-9])/, '- ')
        // every bullet marker starts a new line
        .replace(/\s*([\u2705\u2714\u2713\u2611\u27A4\u25BA\u25B6])\s*/g, '\n$1 ')
    const lines = prepared.split('\n').map(l => collapse(l))

    const blocks: DescriptionBlock[] = []
    let para: string[] = []
    let list: Array<{ label?: string; text: string }> | null = null
    let afterHeading = false

    const flushPara = () => {
        if (!para.length) return
        const text = para.join(' ')
        para = []
        const structured = labelRuns(text) || [{ type: 'p' as const, text }]
        for (const b of structured) {
            if (b.type === 'p') for (const chunk of splitLongParagraph(b.text)) blocks.push({ type: 'p', text: chunk })
            else blocks.push(b)
        }
    }
    const flushList = () => {
        if (list && list.length) blocks.push({ type: 'ul', items: list })
        list = null
    }

    lines.forEach((raw, idx) => {
        if (!raw) {
            flushPara()
            return
        }
        const hadEmoji = LEADING_PICTOGRAPH_RE.test(raw)
        const bullet = BULLET_RE.test(raw)
        let line = collapse((bullet ? raw.replace(BULLET_RE, '') : raw).replace(EMOJI_RE, ' '))
        if (!line || line === '-' || line === '•') return
        if (blocks.length === 0 && para.length === 0 && !list) {
            if (isNameEcho(line, name)) return
            line = stripNameEcho(line, name)
        }

        // Bullet item ("✅ Başlık – açıklama. Devam eden paragraf …")
        if (bullet) {
            flushPara()
            let item = line
            if (!item) return
            // A closing paragraph glued to the last bullet: keep only the first sentence in the item
            let rest = ''
            const cut = item.search(/[.!?]\s+(?=[A-ZÇĞİÖŞÜ])/)
            if (cut > 20 && cut < item.length - 2) {
                rest = item.slice(cut + 1).trim()
                item = item.slice(0, cut + 1).trim()
            }
            list = list || []
            list.push(splitLabel(item))
            if (rest) {
                flushList()
                para.push(rest)
            }
            return
        }

        const next = lines.slice(idx + 1).find(Boolean) || ''
        const looksLikeHeading =
            line.length <= 60 &&
            !/[.!?,;]$/.test(line) &&
            !!next &&
            (hadEmoji || /:$/.test(line) || /^(öne çıkan|özellikler|ürün özellikleri|kutu içeriği|uyumluluk|teknik)/i.test(line))
        if (looksLikeHeading) {
            flushPara()
            flushList()
            blocks.push({ type: 'h', text: line.replace(/:$/, '') })
            afterHeading = true
            return
        }

        // Short lines right after a heading ("Akıllı telefonlar", "120W Turbo: …") read as a list
        if (afterHeading && line.length <= 140) {
            flushPara()
            list = list || []
            list.push(splitLabel(line))
            return
        }

        flushList()
        afterHeading = false
        para.push(line)
    })
    flushPara()
    flushList()
    return blocks
}

export function parseDescription(description: string | null | undefined, productName = ''): ParsedDescription {
    const text = htmlToText(description)
    if (!text.trim()) return { tagline: null, blocks: [], specs: [] }

    const specsAt = text.search(/Teknik Özellikler/i)
    let body = specsAt >= 0 ? text.slice(0, specsAt) : text
    const specs = specsAt >= 0 ? parseSpecs(text.slice(specsAt + 'Teknik Özellikler'.length)) : []

    let tagline: string | null = null
    const detailAt = body.search(/Detaylı Bilgi/i)
    if (detailAt >= 0) {
        const head = collapse(body.slice(0, detailAt).replace(/Ürün Açıklaması/i, ' ').replace(/\n/g, ' '))
        // All-caps heads ("CAM EKRAN KORUYUCU") are category labels from the old shop, not taglines
        const shouting = head === head.toLocaleUpperCase('tr-TR')
        if (head && head.length <= 90 && !shouting && !isNameEcho(head, productName)) tagline = head.replace(/[.:]$/, '')
        body = body.slice(detailAt + 'Detaylı Bilgi'.length).replace(/^\s*Ürün Açıklaması\s*:?\s*/i, '')
    } else {
        body = body.replace(/^\s*Ürün Açıklaması\s*/i, '')
    }

    return { tagline, blocks: toBlocks(body, productName), specs }
}

/** Plain text of an admin HTML snippet (delivery_info, warranty_info), without a leading "TESLİMAT"-style caption. */
export function infoText(html: string | null | undefined): string {
    const lines = htmlToText(html)
        .split('\n')
        .map(l => collapse(l))
        .filter(Boolean)
    if (lines.length > 1 && lines[0].length <= 24 && lines[0] === lines[0].toLocaleUpperCase('tr-TR')) lines.shift()
    return lines.join(' ')
}
