/**
 * Admin › Yönlendirmeler › "Search Console listesini yükle": reads a pasted list or a Search Console CSV export
 * and says, for every address of this site, what happens to it today and where it could go. Nothing is saved
 * here; the admin confirms the rows to keep, which the page then posts to /api/admin/redirects/ in bulk.
 *
 *   POST { text } → { rows: [{ input, path, status, current?, suggestions }], total, truncated, foreign }
 *     status: live | has-redirect | auto | suggested | none | protected | invalid (lib/redirects.ts classifyUrl)
 *
 * Admin only; private, no-store.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { classifyUrl, extractUrls } from '@/lib/redirects'
import { existingRedirects, NO_STORE, redirectsAdminContext } from '@/lib/redirects-server'

export const dynamic = 'force-dynamic'

const MAX_URLS = 1000
const MAX_TEXT = 2_000_000

function fail(error: string, status = 400) {
    return NextResponse.json({ error }, { status, headers: NO_STORE })
}

export async function POST(req: NextRequest) {
    const denied = await requireAdmin()
    if (denied) return denied
    let text = ''
    try {
        const body = await req.json()
        text = typeof body?.text === 'string' ? body.text : ''
    } catch {
        return fail('İstek okunamadı.')
    }
    if (!text.trim()) return fail('Liste boş. Search Console’dan indirdiğiniz CSV dosyasını seçin ya da adresleri yapıştırın.')
    if (text.length > MAX_TEXT) return fail('Liste çok büyük. Dosyayı parçalara bölüp tekrar deneyin.')
    try {
        const all = extractUrls(text, MAX_URLS + 1)
        const urls = all.slice(0, MAX_URLS)
        // Lines that look like URLs of other sites (not ours) are dropped by extractUrls; say how many
        const foreign = (text.match(/https?:\/\/[^\s",;<>]+/gi) ?? []).filter(u => !/^https?:\/\/(?:www\.)?onopostore\.com(?:[/?#]|$)/i.test(u)).length
        if (!urls.length) return fail('Listede bu siteye ait adres bulunamadı.')
        const { db, index, imageExists } = await redirectsAdminContext()
        const existing = await existingRedirects(db)
        const rows = []
        for (const input of urls) {
            rows.push(await classifyUrl(input, { index, imageExists, existing: key => existing.get(key) ?? null }))
        }
        return NextResponse.json({ rows, total: rows.length, truncated: all.length > MAX_URLS, foreign }, { headers: NO_STORE })
    } catch (error) {
        console.error('[admin/redirects/resolve] failed', error)
        return fail('Liste işlenemedi.', 500)
    }
}
