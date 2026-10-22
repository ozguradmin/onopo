/**
 * Product barcodes (GTIN-8/12/13/14, i.e. EAN-8, UPC-A, EAN-13, ITF-14) in `products.gtin`.
 *
 * Plain module without server imports: the admin forms validate with it in the browser, the product APIs
 * validate again on the server, and the feeds and the Product JSON-LD use it to decide what to publish.
 * The column is added by migrations/2026-10-22-product-gtin.sql; until that has run every reader must
 * cope with it missing (see hasGtinColumn).
 */

/** Digits only: spaces and dashes typed or pasted with the barcode are dropped. */
export function normalizeGtin(value: unknown): string {
    return String(value ?? '').replace(/[\s-]/g, '').trim()
}

/** GS1 check digit validation for GTIN-8/12/13/14. */
export function isValidGtin(code: string | null | undefined): boolean {
    if (!code || !/^(\d{8}|\d{12,14})$/.test(code)) return false
    const digits = code.split('').map(Number)
    const check = digits.pop() as number
    const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0)
    return (10 - (sum % 10)) % 10 === check
}

/**
 * Turkish error for the admin form, or null when the value may be saved (empty is allowed: most products
 * have no barcode yet).
 */
export function gtinError(value: unknown): string | null {
    const code = normalizeGtin(value)
    if (!code) return null
    if (!/^\d+$/.test(code)) return 'Barkod yalnızca rakamlardan oluşmalı.'
    if (![8, 12, 13, 14].includes(code.length)) return 'Barkod 8, 12, 13 ya da 14 haneli olmalı.'
    if (!isValidGtin(code)) return 'Barkodun kontrol hanesi tutmuyor; rakamları kontrol edin.'
    return null
}

/** The value to store: a valid barcode or null (empty, or invalid input that slipped past the form). */
export function gtinForStorage(value: unknown): string | null {
    const code = normalizeGtin(value)
    return code && isValidGtin(code) ? code : null
}

/** schema.org property for a valid barcode: gtin8 / gtin12 / gtin13 / gtin14. */
export function gtinJsonLdKey(code: string): 'gtin8' | 'gtin12' | 'gtin13' | 'gtin14' {
    return code.length === 8 ? 'gtin8' : code.length === 12 ? 'gtin12' : code.length === 14 ? 'gtin14' : 'gtin13'
}

/** The few D1 methods used here (a real D1Database satisfies it). */
interface GtinDb {
    prepare(sql: string): { first<T = Record<string, unknown>>(): Promise<T | null> }
}

// Only a positive answer is remembered: once the migration has run the column never goes away, and until
// then every call looks again (cheap: a LIMIT 1 on a 120-row table)
let gtinColumnSeen = false

/** Whether products.gtin exists yet (migrations/2026-10-22-product-gtin.sql). Never throws. */
export async function hasGtinColumn(db: GtinDb): Promise<boolean> {
    if (gtinColumnSeen) return true
    try {
        await db.prepare('SELECT gtin FROM products LIMIT 1').first()
        gtinColumnSeen = true
        return true
    } catch {
        return false
    }
}

interface GtinWriteDb {
    prepare(sql: string): { bind(...values: unknown[]): { run(): Promise<unknown> } }
}

/**
 * Stores the barcode of one product (validate with gtinError first; anything invalid is stored as NULL).
 * 'no_column' while migrations/2026-10-22-product-gtin.sql has not run: the rest of the product save still
 * counts, the barcode is simply not kept yet.
 */
export async function writeProductGtin(db: GtinWriteDb, productId: number, value: unknown): Promise<'saved' | 'no_column'> {
    try {
        await db.prepare('UPDATE products SET gtin = ? WHERE id = ?').bind(gtinForStorage(value), productId).run()
        gtinColumnSeen = true
        return 'saved'
    } catch (err) {
        if (/no such column/i.test(err instanceof Error ? err.message : String(err))) return 'no_column'
        throw err
    }
}

/** Admin warning when a barcode was entered but could not be kept yet. */
export const GTIN_NOT_SAVED_WARNING = 'Barkod kaydedilemedi: veritabanı güncellemesi (2026-10-22-product-gtin.sql) henüz çalıştırılmadı. Diğer bilgiler kaydedildi.'
