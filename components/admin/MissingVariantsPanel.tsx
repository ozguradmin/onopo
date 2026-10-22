'use client'

import * as React from 'react'
import { AlertTriangle, CheckCircle, Loader2, Search, Wand2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IMAGE_VARIANTS_ENABLED, R2_PUBLIC_HOST, imageKey } from '@/lib/images'
import { IMAGE_VARIANT_WIDTHS, canEncodeWebp, createMissingVariants } from '@/lib/imageVariants'
import { parseProductImages } from '@/lib/utils'

/**
 * Admin › Görsel Optimizasyonu › Eksik varyantlar.
 * Lists the product, hero, image-card and logo images whose WebP variants (https://images.onopostore.com/v/<w>/<key>.webp)
 * are missing (HEAD from the browser; the image host allows CORS), and creates them here in the browser, one image at
 * a time, with lib/imageVariants: the original is downloaded, resized and stored via POST /api/admin/upload (variantOf).
 */

// Keys the upload API accepts as variantOf (app/api/admin/upload/route.ts)
const UPLOADABLE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/
const HEAD_CONCURRENCY = 6

interface ImageEntry {
    key: string
    uses: string[]
    isLogo: boolean
    missing: number[]
    state: 'missing' | 'working' | 'done' | 'failed'
    note?: string
}

type Phase = 'idle' | 'scanning' | 'scanned' | 'creating' | 'created'

async function getJson(url: string): Promise<any> {
    try {
        const res = await fetch(url, { cache: 'no-store' })
        return res.ok ? await res.json() : null
    } catch {
        return null
    }
}

// Every R2 image the storefront would show as a variant, keyed by R2 key
async function collectImages(): Promise<{ entries: ImageEntry[]; unsupported: number; sourcesFailed: string[] }> {
    const [products, slides, sections, settings] = await Promise.all([
        getJson('/api/products?includeAll=true&includeInactive=true'),
        getJson('/api/hero-slides'),
        getJson('/api/homepage-sections'),
        getJson('/api/site-settings'),
    ])
    const sourcesFailed: string[] = []
    if (!Array.isArray(products)) sourcesFailed.push('ürünler')
    if (!Array.isArray(slides)) sourcesFailed.push('hero')
    if (!Array.isArray(sections)) sourcesFailed.push('ana sayfa bölümleri')
    if (!settings || typeof settings !== 'object' || settings.error) sourcesFailed.push('site ayarları')

    const byKey = new Map<string, ImageEntry>()
    const unsupported = new Set<string>()
    const add = (ref: unknown, use: string, isLogo = false) => {
        if (typeof ref !== 'string' || !ref.trim()) return
        const key = imageKey(ref)
        if (!key) return // not in R2 (external URL, data: URI, local file): the storefront shows it as it is
        if (!UPLOADABLE_KEY.test(key) || /\.(svg|gif)$/i.test(key)) {
            unsupported.add(key)
            return
        }
        const entry = byKey.get(key) ?? { key, uses: [], isLogo: false, missing: [], state: 'missing' as const }
        if (!entry.uses.includes(use)) entry.uses.push(use)
        entry.isLogo ||= isLogo
        byKey.set(key, entry)
    }

    if (settings && typeof settings === 'object') add(settings.logo_url, 'Logo', true)
    for (const slide of Array.isArray(slides) ? slides : []) add(slide?.image_url, `Hero: ${slide?.title || 'görsel'}`)
    for (const section of Array.isArray(sections) ? sections : []) {
        if (section?.type === 'image_card') add(section?.config?.image_url, `Görsel kart: ${section?.title || section?.config?.title || 'kart'}`)
    }
    for (const product of Array.isArray(products) ? products : []) {
        for (const ref of parseProductImages(product?.images)) add(ref, `Ürün: ${product?.name || `#${product?.id}`}`)
    }
    return { entries: [...byKey.values()], unsupported: unsupported.size, sourcesFailed }
}

// true: the variant exists, false: 404, null: could not be checked
async function variantExists(key: string, width: number): Promise<boolean | null> {
    try {
        const res = await fetch(`${R2_PUBLIC_HOST}/v/${width}/${key}.webp`, { method: 'HEAD', cache: 'no-store' })
        if (res.ok) return true
        return res.status === 404 ? false : null
    } catch {
        return null
    }
}

function reasonText(reason: string): string {
    if (reason === 'no-webp') return 'Bu tarayıcı WebP üretemiyor.'
    if (reason === 'download') return 'Orijinal indirilemedi (bağlantı hatası).'
    if (reason.startsWith('download-')) return `Orijinal indirilemedi (HTTP ${reason.slice('download-'.length)}).`
    if (reason === 'decode') return 'Görsel açılamadı.'
    if (reason === 'encode') return 'WebP üretilemedi.'
    if (reason === 'upload') return 'Yükleme bağlantı hatasıyla kesildi.'
    if (reason === '404') return 'Orijinal depoda (R2) bulunamadı.'
    if (reason === '401' || reason === '403') return 'Oturumun sona ermiş; yeniden giriş yap.'
    return `Yükleme hatası (HTTP ${reason}).`
}

export function MissingVariantsPanel() {
    const [phase, setPhase] = React.useState<Phase>('idle')
    const [webp, setWebp] = React.useState<boolean | null>(null)
    const [entries, setEntries] = React.useState<ImageEntry[]>([])
    const [scanInfo, setScanInfo] = React.useState({ images: 0, unsupported: 0, unchecked: 0, sourcesFailed: [] as string[] })
    const [progress, setProgress] = React.useState({ done: 0, total: 0 })
    const [current, setCurrent] = React.useState('')
    const [summary, setSummary] = React.useState('')
    const stopRef = React.useRef(false)

    React.useEffect(() => {
        let alive = true
        canEncodeWebp().then(ok => { if (alive) setWebp(ok) }, () => { if (alive) setWebp(false) })
        return () => { alive = false }
    }, [])

    const busy = phase === 'scanning' || phase === 'creating'
    const missingEntries = entries.filter(e => e.missing.length > 0)
    const missingFiles = missingEntries.reduce((n, e) => n + e.missing.length, 0)

    const scan = async () => {
        setPhase('scanning')
        setSummary('')
        setEntries([])
        setProgress({ done: 0, total: 0 })
        const { entries: found, unsupported, sourcesFailed } = await collectImages()
        const checks = found.flatMap(entry => IMAGE_VARIANT_WIDTHS.map(width => ({ entry, width })))
        setProgress({ done: 0, total: checks.length })
        let done = 0
        let unchecked = 0
        let next = 0
        const worker = async () => {
            while (next < checks.length) {
                const { entry, width } = checks[next++]
                const exists = await variantExists(entry.key, width)
                if (exists === false) entry.missing.push(width)
                if (exists === null) unchecked++
                done++
                if (done % 12 === 0 || done === checks.length) setProgress({ done, total: checks.length })
            }
        }
        await Promise.all(Array.from({ length: Math.min(HEAD_CONCURRENCY, checks.length) }, worker))
        for (const entry of found) entry.missing.sort((a, b) => a - b)
        setEntries(found)
        setScanInfo({ images: found.length, unsupported, unchecked, sourcesFailed })
        setProgress({ done: checks.length, total: checks.length })
        setPhase('scanned')
    }

    const create = async () => {
        if (!webp) return
        stopRef.current = false
        setPhase('creating')
        setSummary('')
        const todo = entries.filter(e => e.missing.length > 0 && e.state !== 'done')
        setProgress({ done: 0, total: todo.length })
        let ok = 0
        let failed = 0
        let stoppedBySession = false
        for (let i = 0; i < todo.length; i++) {
            if (stopRef.current) break
            const entry = todo[i]
            setCurrent(entry.uses[0])
            setEntries(list => list.map(e => (e.key === entry.key ? { ...e, state: 'working', note: undefined } : e)))
            const result = await createMissingVariants(`${R2_PUBLIC_HOST}/${entry.key}`, entry.key, entry.missing, { keepTransparency: entry.isLogo })
            const remaining = entry.missing.filter(w => !result.stored.includes(w))
            const fine = !result.failed && remaining.length === 0
            if (fine) ok++
            else failed++
            setEntries(list => list.map(e => (e.key === entry.key
                ? { ...e, missing: remaining, state: fine ? 'done' : 'failed', note: result.failed ? reasonText(result.failed.reason) : undefined }
                : e)))
            setProgress({ done: i + 1, total: todo.length })
            if (result.failed && (result.failed.reason === '401' || result.failed.reason === '403' || result.failed.reason === 'no-webp')) {
                stoppedBySession = true
                break
            }
        }
        setCurrent('')
        setPhase('created')
        setSummary(
            `${ok} görselin varyantları oluşturuldu` +
            (failed ? `, ${failed} görselde hata var` : '') +
            (stoppedBySession ? '. İşlem durdu: aşağıdaki hatayı gider ve yeniden dene.' : stopRef.current ? '. İşlemi durdurdun.' : '.')
        )
    }

    const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

    return (
        <section className="mt-8 max-w-2xl rounded-xl border border-slate-200 bg-white p-6 sm:p-8" aria-labelledby="missing-variants-title">
            <h2 id="missing-variants-title" className="text-xl font-bold text-slate-900">Eksik görsel varyantları</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Varyantlar açıkken mağaza ürün, hero, görsel kart ve logo görsellerinin küçültülmüş WebP kopyalarını
                ({IMAGE_VARIANT_WIDTHS.join(', ')} px) gösterir. Kopyası olmayan görsel önce boşa istenir, sonra orijinale düşer.
                Buradan eksikleri bulup bu tarayıcıda oluşturabilirsin.
            </p>
            <p className="mt-2 text-sm text-slate-600">
                Varyantlar mağazada şu an: <span className="font-semibold">{IMAGE_VARIANTS_ENABLED ? 'açık' : 'kapalı'}</span>
            </p>

            {webp === false && (
                <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                    <p>
                        Bu tarayıcı WebP üretemiyor (örneğin eski Safari). Eksikleri tarayabilirsin ama oluşturmak için bu sayfayı
                        güncel Chrome, Edge ya da Firefox ile aç.
                    </p>
                </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
                <Button type="button" onClick={scan} disabled={busy} variant="outline" className="gap-2">
                    {phase === 'scanning' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {phase === 'idle' ? 'Eksikleri tara' : 'Yeniden tara'}
                </Button>
                {(phase === 'scanned' || phase === 'creating' || phase === 'created') && missingEntries.length > 0 && (
                    phase === 'creating' ? (
                        <Button type="button" variant="outline" onClick={() => { stopRef.current = true }} className="gap-2">
                            Durdur
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            onClick={create}
                            disabled={!webp}
                            className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
                        >
                            <Wand2 className="h-4 w-4" />
                            Eksikleri oluştur ({missingEntries.length} görsel)
                        </Button>
                    )
                )}
            </div>

            <div aria-live="polite" className="mt-4 space-y-2 text-sm">
                {busy && (
                    <>
                        <div className="flex justify-between font-medium text-slate-700">
                            <span>
                                {phase === 'scanning'
                                    ? progress.total ? `${progress.done} / ${progress.total} dosya kontrol edildi` : 'Görseller toplanıyor…'
                                    : `${progress.done} / ${progress.total} görsel`}
                            </span>
                            <span>{pct}%</span>
                        </div>
                        <div
                            className="h-2 overflow-hidden rounded-full border border-slate-200 bg-slate-50"
                            role="progressbar"
                            aria-label={phase === 'scanning' ? 'Tarama' : 'Varyant oluşturma'}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={pct}
                        >
                            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        {phase === 'creating' && (
                            <p className="text-xs text-slate-500">
                                Şu an: <span className="break-words">{current}</span>. İşlem bu tarayıcıda çalışıyor; bitene kadar sekmeyi kapatma.
                            </p>
                        )}
                    </>
                )}

                {(phase === 'scanned' || phase === 'created') && (
                    <div className="space-y-1 text-slate-700">
                        {scanInfo.sourcesFailed.length > 0 && (
                            <p className="text-red-600">Okunamayan kaynak: {scanInfo.sourcesFailed.join(', ')}. Liste eksik olabilir; yeniden tara.</p>
                        )}
                        {missingEntries.length === 0 && scanInfo.unchecked === 0 ? (
                            <p className="flex items-center gap-2 font-medium text-green-700">
                                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                                {scanInfo.images} görselin tüm varyantları var.
                            </p>
                        ) : (
                            <p>
                                {scanInfo.images} görselden <span className="font-semibold">{missingEntries.length}</span> tanesinin varyantı eksik
                                ({missingFiles} dosya).
                            </p>
                        )}
                        {scanInfo.unchecked > 0 && (
                            <p className="text-amber-700">{scanInfo.unchecked} dosya kontrol edilemedi (bağlantı hatası); yeniden tara.</p>
                        )}
                        {scanInfo.unsupported > 0 && (
                            <p className="text-slate-500">{scanInfo.unsupported} SVG/GIF ya da desteklenmeyen adlı görsel atlandı (orijinali gösterilir).</p>
                        )}
                        {summary && <p className="font-medium">{summary}</p>}
                    </div>
                )}
            </div>

            {entries.some(e => e.missing.length > 0 || e.state !== 'missing') && (
                <ul className="mt-4 max-h-96 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-sm">
                    {entries.filter(e => e.missing.length > 0 || e.state !== 'missing').map(entry => (
                        <li key={entry.key} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                            <div className="min-w-0">
                                <p className="break-words font-medium text-slate-900">
                                    {entry.uses[0]}
                                    {entry.uses.length > 1 && <span className="font-normal text-slate-500"> +{entry.uses.length - 1}</span>}
                                </p>
                                <p className="truncate font-mono text-xs text-slate-500" title={entry.key}>{entry.key}</p>
                                {entry.note && <p className="text-xs text-red-600">{entry.note}</p>}
                            </div>
                            <div className="shrink-0 text-xs text-slate-600 sm:text-right">
                                {entry.state === 'done' && <span className="font-semibold text-green-700">Oluşturuldu</span>}
                                {entry.state === 'working' && <span className="font-semibold text-blue-700">Oluşturuluyor…</span>}
                                {(entry.state === 'missing' || entry.state === 'failed') && entry.missing.length > 0 && (
                                    <span>Eksik: {entry.missing.join(', ')} px</span>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
