/**
 * Onopo Asistan: the rows of the comparison card (pure, isomorphic).
 *
 * Why: the card used to show the same seven rows for everything, so two screen protectors got four rows of
 * "—" (owner complaint). The rows now depend on what is compared (the products' groups): type, anti-static,
 * coverage and model for screen protectors; power, ports and cable-in-box for chargers; ends, length, power
 * and braiding for cables; and so on. Every value comes from the product's own data (name, the
 * <urun_bilgileri> facts line, the description and its spec table); what the data does not say stays empty,
 * and a row that is empty for every product is not shown. Fiyat and Stok are server values; Kargo and
 * Garanti appear only when they differ.
 *
 * The model may add the differences it found (show_comparison `rows`). It writes text, so every cell is
 * checked against that product's data: each number (with its unit) must be in the data, every word must be
 * in the data, and "Var"/"Yok" needs the data to name the feature with the same polarity. Cells that fail are
 * dropped; the model never sets Fiyat, Stok or Kargo.
 */
import type { GroupKey } from './contract'
import { formatPriceTR } from './contract'
import type { CatalogRow } from './catalog-block'
import { detectDevice } from './device'
import { amountText } from './facts'
import { foldTr } from '../search'
import { formatNumberTR } from '../format'
import { cleanDescriptionText, productModelTokens } from '../seo'
import { infoText, parseDescription } from '../../components/pdp/description-parser'

export interface CompareRow {
    label: string
    values: string[]
}

/** One compared product: its catalogue row, its facts line and what get_product reads (any may be missing). */
export interface CompareItem {
    row: CatalogRow
    facts?: string | null
    detail?: { description: string | null; warranty_info: string | null } | null
}

/** A cell the data does not fill. */
export const EMPTY_CELL = '—'
export const MODEL_ROWS_MAX = 5
export const MODEL_LABEL_MAX = 24
export const MODEL_VALUE_MAX = 40

// ---------------------------------------------------------------------------------------------
// The product's data as text
// ---------------------------------------------------------------------------------------------

const STOCK_LINE = /\bstok(?:\s*adedi)?\s*:?\s*\d+(?:\s*adet)?/gi

/** "Kutu: …; Güç: 67W; …" → folded key → value ("kutu" → "adaptör ve 1 m Type-C kablo"). */
export function factsFields(line: string | null | undefined): Map<string, string> {
    const out = new Map<string, string>()
    for (const part of String(line ?? '').replace(/…\s*$/, '').split(';')) {
        const m = /^\s*([^:]{2,24}):\s*(.+?)\s*$/.exec(part)
        if (m && !out.has(foldTr(m[1]).trim())) out.set(foldTr(m[1]).trim(), m[2])
    }
    return out
}

interface Parsed {
    item: CatalogRow
    /** folded name */
    fn: string
    fields: Map<string, string>
    /** folded name + facts + description + specs + warranty: what a cell may claim */
    all: string
}

function descriptionText(item: CompareItem): string {
    const d = item.detail?.description ?? ''
    if (!d) return ''
    let specs = ''
    try {
        specs = parseDescription(d, item.row.name).specs.filter(s => !/desi|stok/i.test(s.label)).map(s => `${s.label}: ${s.value}`).join('; ')
    } catch {
        specs = ''
    }
    return `${cleanDescriptionText(d)} ${specs}`.replace(STOCK_LINE, ' ')
}

/** Everything the data says about one product, as one text (the model's cells are checked against it). */
export function productDataText(item: CompareItem): string {
    return [item.row.name, item.facts ?? '', descriptionText(item), infoText(item.detail?.warranty_info ?? '')].join(' \n ')
}

function parse(item: CompareItem): Parsed {
    return { item: item.row, fn: foldTr(item.row.name), fields: factsFields(item.facts), all: foldTr(productDataText(item)) }
}

const field = (p: Parsed, key: string) => foldTr(p.fields.get(key) ?? '')
const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : s)
const cut = (s: string, max = MODEL_VALUE_MAX) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)
const dec = (s: string) => s.replace('.', ',')

// ---------------------------------------------------------------------------------------------
// Values the server reads from the data (empty string = the data does not say)
// ---------------------------------------------------------------------------------------------

/** "67W": the name first, then the facts' Güç field. */
function watts(p: Parsed): string {
    const re = /(?:^|[^\d.,])(\d{1,3}(?:[.,]\d)?)\s?(?:w|watt)\b/
    const m = re.exec(p.fn) ?? re.exec(field(p, 'guc'))
    return m ? `${dec(m[1])}W` : ''
}

/** "3,4A" (the name first, then the facts). */
function amps(p: Parsed): string {
    const re = /(?:^|[^\d.,])(\d(?:[.,]\d)?)\s?a\b/
    const m = re.exec(p.fn) ?? re.exec(field(p, 'guc')) ?? re.exec(field(p, 'akim'))
    return m ? `${dec(m[1])}A` : ''
}

function lengthOf(p: Parsed): string {
    const re = /(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s?(metre|mt|m|cm)\b/
    const m = re.exec(p.fn.replace(/(\d)\s?mm\b/g, '$1 _')) ?? re.exec(field(p, 'uzunluk'))
    if (!m) return ''
    // "100 cm" and "1 m" are the same cable: whole metres are written in metres
    const cm = m[2] === 'cm' ? Number(m[1].replace(',', '.')) : NaN
    if (cm >= 100 && cm % 50 === 0) return `${dec(String(cm / 100))} m`
    return `${dec(m[1])} ${m[2] === 'cm' ? 'cm' : 'm'}`
}

function capacity(p: Parsed): string {
    const m = /(\d{1,2}[.,]?\d{3})\s?mah/.exec(p.fn) ?? /(\d{1,2}[.,]?\d{3})\s?mah/.exec(field(p, 'kapasite') || field(p, 'guc'))
    if (!m) return ''
    return `${formatNumberTR(Number(m[1].replace(/[.,]/g, '')), 0)} mAh`
}

type Conn = 'Type-C' | 'USB-A' | 'Lightning' | 'Micro USB' | '3,5 mm jak'
const CONN_RE = /(type[\s-]?c|usb[\s-]?c|micro[\s-]?usb|micro|lightning|usb[\s-]?a|usb|3[.,]5\s?mm|aux|jack|jak)/g

function connOf(token: string): Conn {
    if (/type|usb[\s-]?c/.test(token)) return 'Type-C'
    if (/micro/.test(token)) return 'Micro USB'
    if (/lightning/.test(token)) return 'Lightning'
    if (/3[.,]5|aux|jac?k/.test(token)) return '3,5 mm jak'
    return 'USB-A'
}

/** Connectors in a folded text, in order, with the count written before each ("çift usb" → 2). */
function connectorList(text: string): { conn: Conn; count: number; at: number; end: number }[] {
    const out: { conn: Conn; count: number; at: number; end: number }[] = []
    for (const m of text.matchAll(CONN_RE)) {
        const before = text.slice(Math.max(0, m.index! - 9), m.index!)
        const c = /(?:^|[\s(])(cift|iki|uc|[2-4])\s+(?:adet\s+)?$/.exec(before)?.[1]
        const count = c ? ({ cift: 2, iki: 2, uc: 3 } as Record<string, number>)[c] ?? Number(c) : 1
        out.push({ conn: connOf(m[1]), count, at: m.index!, end: m.index! + m[0].length })
    }
    return out
}

function portText(list: { conn: Conn; count: number }[]): string {
    const merged: { conn: Conn; count: number }[] = []
    for (const x of list) {
        const same = merged.find(y => y.conn === x.conn)
        if (same) same.count = Math.max(same.count, x.count)
        else merged.push({ ...x })
    }
    return merged.map(x => (x.count > 1 ? `${x.count}× ${x.conn}` : x.conn)).join(' + ')
}

/** The connector written right next to "kablo" in a name ("Esnek Type-C Kablo", "Kablo Type-C", "Micro USB Kablolu"). */
function cableConnector(fn: string): { conn: Conn; at: number; end: number } | null {
    const list = connectorList(fn)
    for (const k of fn.matchAll(/kablo\w*/g)) {
        const near = list.filter(c => (c.end <= k.index! && k.index! - c.end <= 8) || (c.at >= k.index! + k[0].length && c.at - (k.index! + k[0].length) <= 2))
        if (near.length) return near[near.length - 1]
    }
    return null
}

const PORT_GROUPS: ReadonlySet<GroupKey> = new Set(['sarj-aleti', 'arac-sarj', 'powerbank'])

/**
 * Ports of a charger, car charger or power bank: only where the data says so for sure. A "… girişli/çıkışlı"
 * phrase in the name or the facts, or an adapter without a cable whose name names its port. A connector next
 * to "kablo" is the cable, and Micro USB / Lightning are never adapter ports. Otherwise empty.
 */
function chargerPorts(p: Parsed): string {
    if (!PORT_GROUPS.has(p.item.group)) return ''
    const phrase = /((?:(?:cift|iki|uc|[2-4])\s+(?:adet\s+)?)?(?:type[\s-]?c|usb[\s-]?[ac]|usb)(?:\s*\(?(?:pd|qc)\)?)?(?:\s*(?:ve|\+|,|ile)\s*(?:(?:cift|iki|uc|[2-4])\s+(?:adet\s+)?)?(?:type[\s-]?c|usb[\s-]?[ac]|usb)(?:\s*\(?(?:pd|qc)\)?)?)*)\s+(?:girisli|cikisli|girisi|cikisi|cikis\b|port)/
    const fromPhrase = (t: string) => {
        const m = phrase.exec(t)
        return m ? portText(connectorList(m[1]).filter(c => c.conn === 'Type-C' || c.conn === 'USB-A')) : ''
    }
    if (p.item.group === 'powerbank') {
        // A power bank's "giriş" is its input: only the output phrase counts
        const out = /((?:(?:cift|iki|uc|[2-4])\s+(?:adet\s+)?)?(?:type[\s-]?c|usb[\s-]?[ac]|usb)(?:\s*(?:ve|\+|,)\s*(?:(?:cift|iki|uc|[2-4])\s+(?:adet\s+)?)?(?:type[\s-]?c|usb[\s-]?[ac]|usb))*)\s+cikis/.exec(`${p.fn} ; ${field(p, 'baglanti')}`)
        return out ? portText(connectorList(out[1])) : ''
    }
    const named = fromPhrase(p.fn) || fromPhrase(field(p, 'baglanti'))
    if (named) return named
    // No phrase: the name's connectors are the ports only when the product is the adapter alone, or when the
    // cable's connector is the one written next to "kablo" (the X7 "Type-C USB … Şarj Cihazı" says neither)
    const box = field(p, 'kutu')
    const cable = cableConnector(p.fn)
    const adapterOnly = /^(?:yalnizca |sadece )?adaptor(?: basligi)?$|yalnizca adaptor|sadece adaptor|kablo yok/.test(box.trim())
        || (/adaptor|baslig/.test(p.fn) && !/\bset|kablo/.test(p.fn))
        || (p.item.group === 'arac-sarj' && !/kablo/.test(p.fn))
    if (!adapterOnly && !cable) return ''
    return portText(connectorList(p.fn).filter(c => (c.conn === 'Type-C' || c.conn === 'USB-A') && (!cable || c.at !== cable.at)))
}

/** "Var (Type-C)", "Var", "Yok": from the facts' Kutu field, else the name ("Başlığı" / "Seti … Kablo"). */
function cableInBox(p: Parsed): string {
    if (p.item.group !== 'sarj-aleti' && p.item.group !== 'arac-sarj') return ''
    const box = field(p, 'kutu')
    const kind = (t: string) => connectorList(t).map(c => c.conn).find(c => c !== 'USB-A' && c !== '3,5 mm jak') ?? cableConnector(p.fn)?.conn ?? null
    if (box) {
        if (/kablo\s*(yok|dahil degil|haric|bulunmamaktadir)|yalnizca adaptor|sadece adaptor|^adaptor(?: basligi)?$|^adaptor basligi/.test(box.trim())) return 'Yok'
        if (/kablo/.test(box)) {
            const k = kind(box)
            return k ? `Var (${k})` : 'Var'
        }
    }
    if (/baslig/.test(p.fn)) return 'Yok'
    if (/\bset|kablolu|\+\s*(?:sarj\s+)?kablo/.test(p.fn)) {
        const k = cableConnector(p.fn)?.conn ?? null
        return k && k !== 'USB-A' ? `Var (${k})` : 'Var'
    }
    return ''
}

/** "PD, PPS", "Var" or "Yok" (the facts win over the name: a "20W" whose description says no fast charging). */
function fastCharge(p: Parsed): string {
    const protocols = (t: string) => {
        const out: string[] = []
        if (/\bpd\b|power delivery/.test(t)) out.push('PD')
        if (/\bpps\b/.test(t)) out.push('PPS')
        if (/\bqc\b|quick charge/.test(t)) out.push('Quick Charge')
        if (/super ?vooc|\bvooc\b/.test(t)) out.push('VOOC')
        return out
    }
    const f = field(p, 'hizli sarj')
    if (f) {
        if (/^(yok|desteklemez|bulunmamaktadir)/.test(f)) return 'Yok'
        const pr = protocols(`${f} ${p.fn}`)
        return pr.length ? pr.join(', ') : /^var/.test(f) ? 'Var' : ''
    }
    const pr = protocols(p.fn)
    return pr.length ? pr.join(', ') : /hizli sarj|turbo/.test(p.fn) ? 'Var' : ''
}

const END_ORDER: readonly Conn[] = ['USB-A', 'Type-C', 'Lightning', 'Micro USB', '3,5 mm jak']
/** "USB-A – Lightning" whichever way the data wrote it ("Lightning to USB" is the same cable). */
const ends = (pair: Conn[]) => [...pair].sort((a, b) => END_ORDER.indexOf(a) - END_ORDER.indexOf(b)).join(' – ')

/** Cable ends: "USB-A – Type-C", "Type-C – Lightning", "Lightning, Type-C, Micro USB". */
function cableEnds(p: Parsed): string {
    if (p.item.group !== 'kablo') return ''
    const pair = (t: string) => {
        const m = /(type[\s-]?c|usb[\s-]?c|micro(?:[\s-]?usb)?|lightning|usb[\s-]?a|usb)(?:'?(?:dan|den|tan|ten)\s+|\s*(?:to|-|–|>|ile)\s*)(type[\s-]?c|usb[\s-]?c|micro(?:[\s-]?usb)?|lightning|usb[\s-]?a|usb|3[.,]5\s?mm)/.exec(t)
        return m ? ends([connOf(m[1]), connOf(m[2])]) : ''
    }
    const named = pair(p.fn) || pair(field(p, 'baglanti')) || pair(field(p, 'kutu'))
    if (named) return named
    const list = [...new Set(connectorList(p.fn).map(c => c.conn))]
    if (list.length === 1 && list[0] !== '3,5 mm jak') {
        // One end in the name ("Lightning Örgülü …"): the facts may name the other one
        const facts = [...new Set(connectorList(field(p, 'baglanti')).map(c => c.conn))]
        if (facts.length === 2 && facts.includes(list[0])) return ends(facts)
    }
    return list.join(', ')
}

const has = (p: Parsed, re: RegExp) => re.test(p.all)

/** "12D seramik", "9D cam", "Seramik cam". */
function protectorType(p: Parsed): string {
    const d = /(?:^|\s)(\d{1,2})d\b/.exec(p.fn)?.[1]
    const material = /seramik/.test(p.fn) ? (/seramik cam/.test(p.fn) ? 'seramik cam' : 'seramik')
        : /hidrojel|nano/.test(p.fn) ? /hidrojel/.test(p.fn) ? 'hidrojel' : 'nano'
            : /temperli/.test(p.fn) ? 'temperli cam'
                : /\bcam\b/.test(p.fn) ? 'cam' : ''
    return cap([d ? `${d}D` : '', material].filter(Boolean).join(' '))
}

function coverage(p: Parsed): string {
    const out: string[] = []
    if (/tam ekran|tam kaplayan|tam kaplar|full ekran/.test(p.all)) out.push('Tam ekran')
    if (/cerceveli/.test(p.fn)) out.push(/siyah\s+(?:ekran\s+)?cerceveli/.test(p.fn) ? 'Siyah çerçeveli' : 'Çerçeveli')
    return out.join(', ')
}

function surface(p: Parsed): string {
    if (/\bmat\b/.test(p.fn)) return 'Mat'
    if (/hayalet|privacy|gizlilik/.test(p.fn)) return 'Hayalet (gizlilik)'
    if (/seffaf/.test(p.fn) || /^seffaf|\bseffaf/.test(field(p, 'malzeme'))) return 'Şeffaf'
    return ''
}

function deviceModel(p: Parsed): string {
    const fromName = detectDevice(p.item.name) ?? productModelTokens(p.item.name).device ?? ''
    return cut(fromName || (p.fields.get('uyumlu') ?? ''))
}

function headphoneLink(p: Parsed): string {
    const bt = /bluetooth\s?(\d(?:[.,]\d)?)?/.exec(p.all)
    if (bt) return bt[1] ? `Bluetooth ${bt[1].replace(',', '.')}` : 'Bluetooth'
    if (/3[.,]5\s?mm|aux|\bjac?k\b/.test(p.fn)) return '3,5 mm jak'
    const c = connectorList(p.fn).find(x => x.conn === 'Type-C' || x.conn === 'Lightning')
    return c ? c.conn : ''
}

function genericLink(p: Parsed): string {
    return cut(p.fields.get('baglanti') ?? '')
}

function warrantyOf(p: Parsed, item: CompareItem): string {
    const re = /(\d{1,2})\s*(yil|ay)\b/
    const m = re.exec(field(p, 'garanti')) ?? re.exec(foldTr(infoText(item.detail?.warranty_info ?? '')))
    // "24 ay" and "2 yıl" are the same warranty
    if (m) return m[2] === 'ay' && Number(m[1]) % 12 === 0 ? `${Number(m[1]) / 12} yıl` : `${m[1]} ${m[2] === 'yil' ? 'yıl' : 'ay'}`
    const t = infoText(item.detail?.warranty_info ?? '')
    return t ? cut(t) : ''
}

const yes = (re: RegExp) => (p: Parsed) => (has(p, re) ? 'Var' : '')

interface Spec {
    label: string
    value: (p: Parsed) => string
}

const S: Record<string, Spec> = {
    type: { label: 'Tür', value: protectorType },
    antistatic: { label: 'Anti-statik', value: yes(/anti[\s-]?stati[ck]/) },
    coverage: { label: 'Kaplama', value: coverage },
    surface: { label: 'Yüzey', value: surface },
    model: { label: 'Uyumlu model', value: deviceModel },
    power: { label: 'Güç', value: watts },
    ports: { label: 'Çıkış', value: chargerPorts },
    fast: { label: 'Hızlı şarj', value: fastCharge },
    cable: { label: 'Kutuda kablo', value: cableInBox },
    ends: { label: 'Uçlar', value: cableEnds },
    length: { label: 'Uzunluk', value: lengthOf },
    current: { label: 'Akım', value: amps },
    braided: { label: 'Örgülü', value: yes(/orgulu/) },
    capacity: { label: 'Kapasite', value: capacity },
    link: { label: 'Bağlantı', value: headphoneLink },
    anc: { label: 'Gürültü önleme', value: yes(/gurultu (?:onleyici|onleme|engelleyici|engelleme)|\banc\b/) },
    mic: { label: 'Mikrofon', value: yes(/mikrofon/) },
    genericLink: { label: 'Bağlantı', value: genericLink },
}

/** The rows of each group, in display order (lib/assistant/catalog-block.ts groupOf decides the group). */
export const GROUP_SPECS: Record<GroupKey, readonly string[]> = {
    'ekran-koruyucu-seramik': ['type', 'antistatic', 'coverage', 'surface', 'model'],
    'ekran-koruyucu-9d': ['type', 'antistatic', 'coverage', 'surface', 'model'],
    'ekran-koruyucu': ['type', 'antistatic', 'coverage', 'surface', 'model'],
    'sarj-aleti': ['power', 'ports', 'fast', 'cable'],
    'arac-sarj': ['power', 'ports', 'fast', 'cable'],
    kablo: ['ends', 'length', 'power', 'current', 'braided'],
    powerbank: ['capacity', 'ports', 'power', 'fast'],
    kulaklik: ['link', 'anc', 'mic', 'length'],
    supurge: ['power', 'capacity', 'genericLink'],
    yazici: ['genericLink', 'capacity'],
    oyun: ['genericLink'],
    diger: ['power', 'genericLink', 'length', 'capacity'],
}

/** Spec keys for a set of products: their groups' rows, in the order the groups appear (no repeats). */
export function specKeysFor(groups: readonly GroupKey[]): string[] {
    const out: string[] = []
    for (const g of groups) for (const k of GROUP_SPECS[g] ?? []) if (!out.includes(k) && !out.some(o => S[o].label === S[k].label)) out.push(k)
    return out
}

const isEmpty = (v: string | undefined) => !v || v === EMPTY_CELL

/** Rows from the data for these products (rows empty for every product are left out). */
export function specRows(items: readonly CompareItem[]): CompareRow[] {
    const parsed = items.map(parse)
    const rows: CompareRow[] = []
    for (const key of specKeysFor(items.map(i => i.row.group))) {
        const values = parsed.map(p => {
            try {
                return S[key].value(p).trim()
            } catch {
                return ''
            }
        })
        if (values.every(v => !v)) continue
        rows.push({ label: S[key].label, values: values.map(v => v || EMPTY_CELL) })
    }
    return rows
}

// ---------------------------------------------------------------------------------------------
// Rows the model adds (checked cell by cell against each product's data)
// ---------------------------------------------------------------------------------------------

/** Folded text with the connector and spelling variants the data uses made the same. */
function norm(s: string): string {
    return ` ${foldTr(s)} `
        .replace(/(\d),(\d)/g, '$1.$2')
        .replace(/\b(?:usb|type|tip)[\s-]?c\b/g, ' typec ')
        .replace(/\busb[\s-]?a\b/g, ' usb ')
        .replace(/\bstatic\b/g, 'statik')
        .replace(/\bjak\b/g, 'jack')
        .replace(/×/g, ' ')
        .replace(/(\d)\s?x(?=\s)/g, '$1 ')
}

const UNITS: Record<string, string> = {
    w: 'w', watt: 'w', mah: 'mah', cm: 'cm', mm: 'mm', m: 'm', mt: 'm', metre: 'm', a: 'a', amper: 'a', v: 'v', volt: 'v',
    d: 'd', hz: 'hz', inc: 'inc', inch: 'inc', yil: 'yil', ay: 'ay', gb: 'gb', mbps: 'mbps',
}

interface NumToken {
    /** canonical number, lengths in cm */
    n: string
    /** a known unit ("w", "cm" …) */
    unit: string | null
    /** other letters right after the number ("9h", "15 pro"), when they are not a unit */
    suffix: string | null
}

function numTokens(t: string): NumToken[] {
    const out: NumToken[] = []
    for (const m of t.matchAll(/(\d+(?:\.\d+)*)\s*(?:(?:adet|tane)\s+)?([a-z]+)?/g)) {
        const unit = m[2] ? UNITS[m[2]] ?? null : null
        const suffix = m[2] && !unit ? m[2] : null
        let raw = m[1]
        if (/^\d{1,3}(\.\d{3})+$/.test(raw) && (unit === 'mah' || unit == null)) raw = raw.replace(/\./g, '')
        let n = Number(raw)
        if (!Number.isFinite(n)) continue
        let u = unit
        if (u === 'm') { n *= 100; u = 'cm' } else if (u === 'mm') { n /= 10; u = 'cm' }
        out.push({ n: String(Math.round(n * 1000) / 1000), unit: u, suffix })
        // "1.499" may be a thousand or a decimal: keep the parts as plain numbers too
        if (!unit) for (const part of m[1].split('.')) if (part) out.push({ n: String(Number(part)), unit: null, suffix: null })
    }
    return out
}

const YES = new Set(['var', 'evet', 'mevcut', 'destekler', 'dahil'])
const NO = new Set(['yok', 'hayir', 'desteklemez', 'degil', 'haric', 'icermez'])
const SKIP_WORDS = new Set(['ve', 'ile', 'veya', 'icin', 'to', 'ya', 'da', 'de', 'tek', 'adet', 'her', 'iki', ...Object.keys(UNITS)])
const LABEL_FILLER = new Set(['ozellik', 'ozelligi', 'ozellikli', 'destek', 'destegi', 'durumu', 'var', 'mi', 'mı', 'turu', 'tipi'])
const NEGATION = /\b(?:yok|yoktur|degil|degildir|bulunmamaktadir|bulunmuyor|desteklemez|desteklenmez|desteklemiyor|haric|icermez)\b/
/** Labels the model may not set: server values, or things it must never claim. */
const RESERVED_LABEL = /fiyat|stok|kargo|ucret|indirim|kampanya|kupon|puan|yorum|taksit|\btl\b/

export interface DataIndex {
    text: string
    words: Set<string>
    /** number + unit ("20w", "100cm") */
    keyed: Set<string>
    /** every number */
    bare: Set<string>
    /** number → the other words written right after it ("9" → ["d"], "15" → ["pro"]) */
    suffixed: Map<string, string[]>
}

export function dataIndex(text: string): DataIndex {
    const t = norm(text)
    const keyed = new Set<string>()
    const bare = new Set<string>()
    const suffixed = new Map<string, string[]>()
    for (const tok of numTokens(t)) {
        if (tok.unit) keyed.add(`${tok.n}${tok.unit}`)
        if (tok.suffix) suffixed.set(tok.n, [...(suffixed.get(tok.n) ?? []), tok.suffix])
        bare.add(tok.n)
    }
    return { text: t, words: new Set(t.match(/[a-z]+/g) ?? []), keyed, bare, suffixed }
}

const wordIn = (d: DataIndex, w: string) => {
    if (d.words.has(w)) return true
    if (w.length < 4) return false
    const stem = w.slice(0, Math.min(5, w.length))
    for (const x of d.words) if (x.startsWith(stem)) return true
    return false
}

/** Where the data names the feature of `label`: 'yes', 'no', 'both' or null (not named). */
export function featurePolarity(label: string, d: DataIndex): 'yes' | 'no' | 'both' | null {
    const words = (norm(label).match(/[a-z]+/g) ?? []).filter(w => w.length >= 3 && !LABEL_FILLER.has(w))
    if (words.length === 0) return null
    const re = new RegExp(words.map(w => `${w.slice(0, Math.min(4, w.length))}[a-z]*`).join('[\\s-]*'), 'g')
    let pos = false
    let neg = false
    for (const m of d.text.matchAll(re)) {
        const after = d.text.slice(m.index! + m[0].length).split(/[;.\n]/)[0].slice(0, 40)
        const before = d.text.slice(Math.max(0, m.index! - 14), m.index!)
        if (NEGATION.test(after) || /\b(?:yok|olmayan)\s*$/.test(before)) neg = true
        else pos = true
    }
    return pos && neg ? 'both' : pos ? 'yes' : neg ? 'no' : null
}

/** Whether one model cell is backed by this product's data. */
export function cellSupported(label: string, value: string, d: DataIndex): boolean {
    const v = norm(value)
    // Numbers (with their unit) must be in the data
    for (const tok of numTokens(v)) {
        if (tok.unit ? !d.keyed.has(`${tok.n}${tok.unit}`) : !d.bare.has(tok.n)) return false
        // "9H" needs a 9 written with that word ("9D" is not it); "2 çıkışlı" matches "2 çıkış"
        const suffix = tok.suffix
        if (suffix) {
            const stem = suffix.slice(0, Math.min(4, suffix.length))
            if (!(d.suffixed.get(tok.n) ?? []).some(x => x.startsWith(stem) || suffix.startsWith(x))) return false
        }
    }
    // Words, without the unit right after a number ("20 W", "1 m": checked with the number above)
    const words = (v.replace(/\d+(?:\.\d+)*\s*([a-z]*)/g, (_, u: string) => (u && !UNITS[u] ? ` ${u} ` : ' ')).match(/[a-z]+/g) ?? []).filter(w => w.length >= 2)
    const yesNo = words.filter(w => YES.has(w) || NO.has(w))
    // Every other word must be in the data
    for (const w of words) {
        if (YES.has(w) || NO.has(w) || SKIP_WORDS.has(w)) continue
        if (!wordIn(d, w)) return false
    }
    if (yesNo.length) {
        const pol = featurePolarity(label, d)
        if (!pol) return false
        if (yesNo.some(w => YES.has(w)) && pol === 'no') return false
        if (yesNo.some(w => NO.has(w)) && pol === 'yes') return false
    }
    return words.length > 0 || numTokens(v).length > 0
}

const plain = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[<>*_`#\[\]{}|\\]/g, ' ').replace(/\s+/g, ' ').trim() : '').slice(0, max + 1)

export interface ModelRowsResult {
    /** New rows (at least one supported cell each). */
    rows: CompareRow[]
    /** Empty server cells the model filled (row label → product index → value). */
    fills: { label: string; index: number; value: string }[]
    /** Cells dropped because the data does not back them. */
    rejected: number
}

/**
 * The model's `rows` argument, checked: at most 5 rows, label ≤ 24 characters, value ≤ 40; `valueIndex[i]` is
 * where product i's value sits in the model's `values` (its ids order). Reserved labels (Fiyat, Stok, Kargo …)
 * are ignored; a label the server already shows only fills that row's empty cells.
 */
export function checkModelRows(raw: unknown, items: readonly CompareItem[], valueIndex: readonly number[], taken: readonly CompareRow[]): ModelRowsResult {
    const result: ModelRowsResult = { rows: [], fills: [], rejected: 0 }
    if (!Array.isArray(raw)) return result
    const data = items.map(i => dataIndex(productDataText(i)))
    const seen = new Set(taken.map(r => foldTr(r.label).trim()))
    for (const r of raw.slice(0, MODEL_ROWS_MAX)) {
        if (!r || typeof r !== 'object') continue
        const label = plain((r as Record<string, unknown>).label, MODEL_LABEL_MAX)
        const values = (r as Record<string, unknown>).values
        if (!label || label.length > MODEL_LABEL_MAX || !Array.isArray(values)) continue
        const key = foldTr(label).trim()
        if (RESERVED_LABEL.test(key)) continue
        const cells = items.map((_, i) => {
            const v = plain(values[valueIndex[i]], MODEL_VALUE_MAX)
            if (!v || v === EMPTY_CELL || v === '-') return ''
            if (v.length > MODEL_VALUE_MAX || !cellSupported(label, v, data[i])) {
                result.rejected++
                return ''
            }
            return v
        })
        if (cells.every(c => !c)) continue
        const existing = taken.find(t => foldTr(t.label).trim() === key)
        if (existing) {
            cells.forEach((c, i) => {
                if (c && isEmpty(existing.values[i])) result.fills.push({ label: existing.label, index: i, value: c })
            })
            continue
        }
        if (seen.has(key)) continue
        seen.add(key)
        result.rows.push({ label: cap(label), values: cells.map(c => c || EMPTY_CELL) })
    }
    return result
}

// ---------------------------------------------------------------------------------------------
// The whole card
// ---------------------------------------------------------------------------------------------

export interface CompareRowsInput {
    items: readonly CompareItem[]
    freeThreshold: number
    /** show_comparison's `rows` argument (untrusted) */
    modelRows?: unknown
    /** where product i's value is in the model's values (default: i) */
    valueIndex?: readonly number[]
}

/**
 * Fiyat, the group's rows, the model's checked rows, Kargo and Garanti when they differ, Stok. A row with no
 * value for any product is never shown.
 */
export function buildCompareRows(input: CompareRowsInput): { rows: CompareRow[]; rejected: number; added: string[] } {
    const { items } = input
    const parsed = items.map(parse)
    const fixed = specRows(items)
    const model = checkModelRows(input.modelRows, items, input.valueIndex ?? items.map((_, i) => i), fixed)
    for (const f of model.fills) {
        const row = fixed.find(r => r.label === f.label)
        if (row) row.values[f.index] = f.value
    }
    const T = amountText(input.freeThreshold)
    const shipping = items.map(i => (i.row.freeShipping ? 'Ücretsiz' : `${T} TL üzeri ücretsiz`))
    const warranty = items.map((i, n) => warrantyOf(parsed[n], i))
    const differs = (v: string[]) => new Set(v).size > 1
    const rows: CompareRow[] = [
        { label: 'Fiyat', values: items.map(i => formatPriceTR(i.row.displayPrice)) },
        ...fixed,
        ...model.rows,
    ]
    if (differs(shipping)) rows.push({ label: 'Kargo', values: shipping })
    if (differs(warranty) && warranty.some(Boolean)) rows.push({ label: 'Garanti', values: warranty.map(v => v || EMPTY_CELL) })
    rows.push({ label: 'Stok', values: items.map(i => (i.row.inStock ? 'Var' : 'Tükendi')) })
    return { rows, rejected: model.rejected, added: [...model.rows.map(r => r.label), ...new Set(model.fills.map(f => f.label))] }
}
