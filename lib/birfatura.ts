// BirFatura "Özel Entegrasyon" servisleri için ortak yardımcılar.
// Doküman: https://developers.birfatura.com/dokuman/ozel-entegrasyon-api
// BirFatura panelinde mağazanın site adresi olarak https://onopostore.com/api/birfatura girilir;
// BirFatura sonuna /api/orderStatus, /api/orders ... yollarını kendisi ekler.
import { NextRequest, NextResponse } from 'next/server'

// Sitedeki fiyatlar KDV dahil. Ürün tablosunda KDV oranı tutulmadığı için tek oran kullanılıyor.
export const DEFAULT_VAT_RATE = 20

// BirFatura bu ID'leri saklar ve geri gönderir; değerleri değiştirmeyin (liste: lib/order-status.ts, admin de kullanır).
import { ORDER_STATUSES } from '@/lib/order-status'
export { ORDER_STATUSES }

export const PAYMENT_METHODS: { id: number; provider: string; label: string }[] = [
    { id: 1, provider: 'paytr', label: 'Kredi Kartı (PayTR)' },
    { id: 2, provider: 'iyzico', label: 'Kredi Kartı (iyzico)' },
    { id: 3, provider: 'offline', label: 'Banka EFT-Havale' },
]

export function statusFromId(id: number): string | null {
    return ORDER_STATUSES.find(s => s.id === Number(id))?.status ?? null
}

export function paymentMethodFor(provider: string | undefined) {
    return PAYMENT_METHODS.find(p => p.provider === provider) ?? PAYMENT_METHODS[0]
}

async function getExpectedToken(): Promise<string | undefined> {
    try {
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext({ async: true })
        const value = (env as any)?.BIRFATURA_TOKEN
        if (value) return String(value)
    } catch {
        // Cloudflare dışı ortam (yerel next dev)
    }
    return process.env.BIRFATURA_TOKEN
}

function safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return diff === 0
}

// Token yoksa uçlar hiç yokmuş gibi 404, yanlışsa 401 döner.
export async function checkBirfaturaToken(req: NextRequest): Promise<NextResponse | null> {
    const expected = await getExpectedToken()
    if (!expected) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const given = req.headers.get('token') || ''
    if (!given || !safeEqual(given.trim().toLowerCase(), expected.trim().toLowerCase())) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
}

// D1'de created_at UTC olarak tutuluyor (CURRENT_TIMESTAMP); BirFatura Türkiye saati (UTC+3) kullanıyor.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000

// "dd.MM.yyyy HH:mm:ss" (TR saati) -> "yyyy-MM-dd HH:mm:ss" (UTC, D1 karşılaştırması için)
export function trDateToUtcSql(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const m = value.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/)
    if (!m) return null
    const [, dd, MM, yyyy, HH = '00', mm = '00', ss = '00'] = m
    const ms = Date.UTC(+yyyy, +MM - 1, +dd, +HH, +mm, +ss) - TR_OFFSET_MS
    if (Number.isNaN(ms)) return null
    return new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
}

// D1 UTC zaman damgası -> "dd.MM.yyyy HH:mm:ss" (TR saati)
export function utcSqlToTrDate(value: string): string {
    const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z'
    const d = new Date(new Date(iso).getTime() + TR_OFFSET_MS)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

export function taxExcluding(amountTaxIncluding: number, vatRate: number): number {
    return amountTaxIncluding / (1 + vatRate / 100)
}

export async function readJsonBody(req: NextRequest): Promise<any | null> {
    try {
        const body = await req.json()
        return body && typeof body === 'object' && !Array.isArray(body) ? body : null
    } catch {
        return null
    }
}

// invoiceLinkUpdate'in yazdığı kolonlar; eski veritabanında yoksa eklenir.
export async function ensureInvoiceColumns(db: any) {
    for (const col of ['invoice_url TEXT', 'invoice_no TEXT', 'invoice_date TEXT']) {
        try {
            await db.prepare(`ALTER TABLE orders ADD COLUMN ${col}`).run()
        } catch {
            // Kolon zaten var
        }
    }
}
