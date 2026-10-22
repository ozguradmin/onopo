/**
 * Onopo Asistan: store facts, the link targets and Istanbul time (pure, isomorphic).
 *
 * Why: shipping, returns and payment answers are where a shop bot most easily invents a promise. The model
 * gets these facts as one fixed text block built from the same sources the storefront uses
 * (shipping_settings, getMaxInstallments, the CMS return policy, the admin's ai_* settings), and the info
 * cards and FAQ chips are built from the very same values, so text and cards never disagree.
 * Turkey has used UTC+3 all year since 2016, so Istanbul time is a fixed offset (no ICU, deterministic).
 */
import type { InfoRow } from './contract'
import { formatNumberTR } from '../format'

export interface StoreFacts {
    /** getShippingSettings() */
    freeThreshold: number
    shippingCost: number
    /** getMaxInstallments() */
    maxInstallments: number | null
    /** getSiteSeo().returnPolicy ?? { days: 14, freeReturn: false } */
    returnDays: number
    freeReturn: boolean
    /** site_settings.ai_ship_days, default 'hafta-ici' */
    shipDays: 'hafta-ici' | 'hafta-ici-cumartesi'
    /** site_settings.ai_ship_cutoff, default '18:00' */
    cutoff: string
    /** site_settings.ai_support_hours */
    supportHours: string | null
    /** site_settings.ai_campaigns trimmed, '' → 'Yok' */
    campaigns: string
}

export const DEFAULT_FACTS: StoreFacts = {
    freeThreshold: 500,
    shippingCost: 100,
    maxInstallments: null,
    returnDays: 14,
    freeReturn: false,
    shipDays: 'hafta-ici',
    cutoff: '18:00',
    supportHours: null,
    campaigns: 'Yok',
}

/** "500" for whole amounts, "79,99" otherwise. */
export function amountText(n: number): string {
    return formatNumberTR(n, Number.isInteger(n) ? 0 : 2)
}

/** A valid "HH:MM" (00:00–23:59) or the default 18:00. */
export function normalizeCutoff(v: string | null | undefined): string {
    const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(v ?? '')
    if (!m) return '18:00'
    const h = parseInt(m[1], 10)
    const min = parseInt(m[2], 10)
    if (h > 23 || min > 59) return '18:00'
    return `${String(h).padStart(2, '0')}:${m[2]}`
}

/** "Hafta içi" | "Hafta içi ve cumartesi" */
export function shipDaysText(f: Pick<StoreFacts, 'shipDays'>): string {
    return f.shipDays === 'hafta-ici-cumartesi' ? 'Hafta içi ve cumartesi' : 'Hafta içi'
}

/** <magaza_bilgileri> + <kampanyalar> (section 3.4). */
export function buildFactsBlock(f: StoreFacts): string {
    const lines = [
        '<magaza_bilgileri>',
        '- Fiyatlar Türk lirasıdır ve KDV dahildir.',
        `- Kargo: ${amountText(f.freeThreshold)} TL ve üzeri siparişlerde kargo ücretsiz; altında kargo ücreti ${amountText(f.shippingCost)} TL. "ücretsiz kargo" etiketli ürünlerde kargo her zaman ücretsizdir.`,
        `- Kargoya veriliş: ${shipDaysText(f)} saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoya verilir. Teslim süresi kargo firmasına ve adrese göre değişir; kesin teslim tarihi verilmez.`,
        f.maxInstallments
            ? `- Ödeme: kredi kartı ve banka kartı, PayTR güvenli ödeme (256-bit SSL). Kredi kartına ${f.maxInstallments} aya varan taksit; taksit seçenekleri ödeme adımında kartın bankasına göre gösterilir. "Vade farksız" ya da "faizsiz" deme.`
            : '- Ödeme: kredi kartı ve banka kartı, PayTR güvenli ödeme (256-bit SSL). Taksit seçenekleri ödeme adımında kartın bankasına göre gösterilir. "Vade farksız" ya da "faizsiz" deme.',
        `- Cayma ve iade: teslimden itibaren ${f.returnDays} gün cayma hakkı.${f.freeReturn ? ' İade kargo ücreti mağazaya aittir.' : ''} Ambalajı açılmış ve hijyen açısından iadesi uygun olmayan ürünlerde istisna olabilir; iade ve değişim talepleri WhatsApp üzerinden ekiple yürütülür.`,
        '- Garanti: ürün sayfasındaki garanti bilgisi geçerlidir.',
        `- Destek: WhatsApp${f.supportHours ? ` (${f.supportHours})` : ''}. Sipariş takibi: üye girişi yaptıysan "Siparişlerim" sayfası, değilse WhatsApp.`,
        '</magaza_bilgileri>',
        '<kampanyalar>',
        f.campaigns.trim() || 'Yok',
        '</kampanyalar>',
    ]
    return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Link targets (<baglantilar>): keys for the model, hrefs stay on the server
// ---------------------------------------------------------------------------------------------

export interface LinkTarget {
    key: string
    title: string
    href: string
    count: number | null
    fromPrice: number | null
    icon: string | null
}

/** <baglantilar>: one line per target, "key | başlık | ürün sayısı" (the count is left out when unknown). */
export function buildLinksBlock(targets: readonly LinkTarget[]): string {
    const lines = ['<baglantilar>', '# satır: anahtar | başlık | ürün sayısı']
    for (const t of targets) lines.push(`${t.key} | ${t.title}${t.count != null ? ` | ${t.count}` : ''}`)
    lines.push('</baglantilar>')
    return lines.join('\n')
}

// ---------------------------------------------------------------------------------------------
// Istanbul time and same-day dispatch
// ---------------------------------------------------------------------------------------------

export const DAY_NAMES_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'] as const

export interface IstanbulParts {
    /** 'YYYY-MM-DD' */
    date: string
    /** 'HH:MM' */
    time: string
    hour: number
    minute: number
    /** 0 = Sunday */
    weekday: number
    dayName: string
}

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000

export function istanbulParts(date: Date): IstanbulParts {
    const t = new Date(date.getTime() + ISTANBUL_OFFSET_MS)
    const pad = (n: number) => String(n).padStart(2, '0')
    const hour = t.getUTCHours()
    const minute = t.getUTCMinutes()
    const weekday = t.getUTCDay()
    return {
        date: `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`,
        time: `${pad(hour)}:${pad(minute)}`,
        hour,
        minute,
        weekday,
        dayName: DAY_NAMES_TR[weekday],
    }
}

/** 'YYYY-MM-DD' in Istanbul, n days before `date`. */
export function istanbulDay(date: Date, daysBack = 0): string {
    return istanbulParts(new Date(date.getTime() - daysBack * 86_400_000)).date
}

/** Seconds until the next Istanbul midnight (at least 1). */
export function secondsUntilIstanbulMidnight(date: Date): number {
    const p = istanbulParts(date)
    const t = new Date(date.getTime() + ISTANBUL_OFFSET_MS)
    const passed = p.hour * 3600 + p.minute * 60 + t.getUTCSeconds()
    return Math.max(1, 86_400 - passed)
}

function isShipDay(weekday: number, f: Pick<StoreFacts, 'shipDays'>): boolean {
    if (weekday >= 1 && weekday <= 5) return true
    return weekday === 6 && f.shipDays === 'hafta-ici-cumartesi'
}

export interface SameDayInfo {
    /** Today is a shipping day and the time is before the cut-off. */
    sameDay: boolean
    /** Minutes left until the cut-off (only when sameDay). */
    minutesLeft: number | null
    /** Name of the next shipping day (only when not sameDay). */
    nextDayName: string | null
}

export function sameDayInfo(now: Date, f: Pick<StoreFacts, 'shipDays' | 'cutoff'>): SameDayInfo {
    const p = istanbulParts(now)
    const [ch, cm] = normalizeCutoff(f.cutoff).split(':').map(Number)
    const left = ch * 60 + cm - (p.hour * 60 + p.minute)
    if (isShipDay(p.weekday, f) && left > 0) return { sameDay: true, minutesLeft: left, nextDayName: null }
    let wd = p.weekday
    for (let i = 0; i < 7; i++) {
        wd = (wd + 1) % 7
        if (isShipDay(wd, f)) return { sameDay: false, minutesLeft: null, nextDayName: DAY_NAMES_TR[wd] }
    }
    return { sameDay: false, minutesLeft: null, nextDayName: null }
}

// ---------------------------------------------------------------------------------------------
// Store info card rows (section 9.6)
// ---------------------------------------------------------------------------------------------

export type InfoTopic = 'shipping' | 'cutoff' | 'payment' | 'installments' | 'returns' | 'warranty' | 'contact'
export const INFO_TOPICS: readonly InfoTopic[] = ['shipping', 'cutoff', 'payment', 'installments', 'returns', 'warranty', 'contact']

function infoRow(f: StoreFacts, topic: InfoTopic): InfoRow {
    switch (topic) {
        case 'shipping':
            return { icon: 'truck', text: `${amountText(f.freeThreshold)} TL ve üzeri siparişlerde kargo bedava (altında ${amountText(f.shippingCost)} TL).` }
        case 'cutoff':
            return { icon: 'clock', text: `${shipDaysText(f)} saat ${f.cutoff}'e kadar verilen siparişler aynı gün kargoda.` }
        case 'payment':
            return { icon: 'card', text: 'Kredi kartı ya da banka kartıyla PayTR güvenli ödeme (256-bit SSL).' }
        case 'installments':
            return {
                icon: 'card',
                text: f.maxInstallments ? `Kredi kartına ${f.maxInstallments} aya kadar taksit.` : 'Taksit seçenekleri ödeme adımında kartına göre gösterilir.',
            }
        case 'returns':
            return { icon: 'return', text: `${f.returnDays} gün içinde cayma hakkı.` }
        case 'warranty':
            return { icon: 'shield', text: 'Ürün sayfasındaki garanti bilgisi geçerlidir.' }
        case 'contact':
            return { icon: 'chat', text: `WhatsApp desteği${f.supportHours ? ` (${f.supportHours})` : ''}.` }
    }
}

/** Card rows for the requested topics, in the fixed topic order, without duplicates. */
export function infoRows(f: StoreFacts, topics: readonly string[]): InfoRow[] {
    const wanted = new Set(topics)
    const out: InfoRow[] = []
    for (const t of INFO_TOPICS) {
        if (!wanted.has(t)) continue
        const row = infoRow(f, t)
        if (!out.some(r => r.text === row.text)) out.push(row)
    }
    return out
}
