// Browser-only helper for admin image uploads: the FALLBACK. Normally the upload route makes the variants on
// the server (Cloudflare Images binding, lib/image-variants-server.ts) and answers variants: 'server'; then
// nothing happens here. Otherwise, after the original upload, resized WebP copies are made in the admin's browser
// (canvas / OffscreenCanvas) and stored next to the original in R2 under
//   v/<width>/<originalKey>.webp     e.g. v/400/1773939592857-ONOPOT120.png.webp
// so the storefront can later serve https://images.onopostore.com/v/<width>/<key>.webp instead of
// multi-MB originals. Variant failures are only logged: they never block or fail the save.

export const IMAGE_VARIANT_WIDTHS = [200, 400, 800, 1200] as const
const WEBP_QUALITY = 0.8

export interface VariantOptions {
    /**
     * Keep transparency instead of flattening onto white. For the logo: the header shows it on white, but the
     * dark footer inverts it, where a white box would turn into a black one.
     */
    keepTransparency?: boolean
}

/** What happened to one image's variants: the widths stored, and the first width that failed (and why). */
export interface VariantResult {
    stored: number[]
    failed: { width: number; reason: string } | null
}

// R2 key of an uploaded original, from any URL form the upload routes return or the DB stores
export function originalKeyFromUrl(url: string | null | undefined): string | null {
    if (!url) return null
    let key: string | undefined
    if (url.startsWith('/api/images/')) key = url.slice('/api/images/'.length)
    else if (url.includes('.r2.dev/')) key = url.split('.r2.dev/')[1]
    else if (url.startsWith('https://images.onopostore.com/')) key = url.slice('https://images.onopostore.com/'.length)
    if (!key) return null
    key = key.split(/[?#]/)[0]
    return /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/.test(key) ? key : null
}

export function variantKey(originalKey: string, width: number): string {
    return `v/${width}/${originalKey}.webp`
}

// Product and hero images sit on white cards: flattening transparency onto white keeps the WebP
// small (same choice as the batch-generated variants of the existing images)
function flattenOnWhite(context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, width: number, height: number) {
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
}

type Context2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D

// Draws on a white (with keepTransparency: transparent) canvas of the given size and encodes it as WebP;
// null when that fails
async function renderWebp(width: number, height: number, draw?: (context: Context2D) => void, keepTransparency = false): Promise<Blob | null> {
    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height)
        const context = canvas.getContext('2d')
        if (!context) return null
        if (!keepTransparency) flattenOnWhite(context, width, height)
        draw?.(context)
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
        return blob.type === 'image/webp' ? blob : null
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    if (!keepTransparency) flattenOnWhite(context, width, height)
    draw?.(context)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    // Browsers without a WebP encoder silently return PNG: skip rather than store a mislabelled file
    return blob && blob.type === 'image/webp' ? blob : null
}

async function encodeWebp(bitmap: ImageBitmap, maxWidth: number, keepTransparency = false): Promise<Blob | null> {
    // Never upscale: small originals get same-size WebP copies so every width exists
    const width = Math.min(maxWidth, bitmap.width)
    const height = Math.max(1, Math.round(bitmap.height * width / bitmap.width))
    return renderWebp(width, height, context => context.drawImage(bitmap, 0, 0, width, height), keepTransparency)
}

// Whether this browser can encode WebP at all, checked once on a 1x1 canvas (older Safari cannot),
// so photos are never decoded at full size just to find out
let webpEncodingSupported: Promise<boolean> | null = null
export function canEncodeWebp(): Promise<boolean> {
    webpEncodingSupported ??= renderWebp(1, 1).then(blob => blob !== null, () => false)
    return webpEncodingSupported
}

// Encodes and stores the given widths one after another (POST /api/admin/upload with variantOf). Stops at the
// first failure that would repeat for every width: no encoder, no admin session (401/403), original missing (404).
async function uploadVariantsFromBitmap(bitmap: ImageBitmap, key: string, widths: readonly number[], options: VariantOptions): Promise<VariantResult> {
    const stored: number[] = []
    let failed: VariantResult['failed'] = null
    for (const width of widths) {
        const blob = await encodeWebp(bitmap, width, options.keepTransparency)
        if (!blob) return { stored, failed: failed ?? { width, reason: 'encode' } }
        const form = new FormData()
        form.append('file', new File([blob], `${width}.webp`, { type: 'image/webp' }))
        form.append('variantOf', key)
        form.append('width', String(width))
        const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
        if (res.ok) {
            stored.push(width)
            continue
        }
        console.warn(`Image variant ${width}px was not stored (${res.status})`)
        failed ??= { width, reason: String(res.status) }
        if (res.status === 401 || res.status === 403 || res.status === 404) break
    }
    return { stored, failed }
}

async function createAndUploadVariants(file: File, key: string, options: VariantOptions): Promise<void> {
    try {
        if (!(await canEncodeWebp())) return

        const bitmap = await createImageBitmap(file)
        try {
            await uploadVariantsFromBitmap(bitmap, key, IMAGE_VARIANT_WIDTHS, options)
        } finally {
            bitmap.close()
        }
    } catch (error) {
        console.warn('Image variants were not created:', error)
    }
}

// One image at a time: a multi-file upload calls uploadImageVariants once per file without awaiting,
// and decoding several full-size photos at once can run a phone out of memory
let queue: Promise<void> = Promise.resolve()

/** The upload route's answer: `variants: 'server'` = the server makes the variants (Cloudflare Images binding). */
export type UploadAnswer = string | { url?: string | null; variants?: string | null }

/**
 * Creates and uploads the WebP variants of an image that was just uploaded — only when the server did not
 * take the job (fallback; lib/image-variants-server.ts makes them right after the upload when it can).
 * Call without awaiting after the original upload succeeded: `void uploadImageVariants(file, result)`.
 * Calls are queued and processed one after another; the promise settles when this file is done.
 */
export async function uploadImageVariants(file: File, uploaded: UploadAnswer, options: VariantOptions = {}): Promise<void> {
    if (typeof uploaded !== 'string' && uploaded?.variants === 'server') return
    const uploadedUrl = typeof uploaded === 'string' ? uploaded : uploaded?.url ?? ''
    const key = originalKeyFromUrl(uploadedUrl)
    if (!key || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return
    if (typeof createImageBitmap !== 'function') return

    const job = queue.then(() => createAndUploadVariants(file, key, options))
    queue = job.catch(() => { })
    return job
}

/**
 * Backfill (Admin › Görsel Optimizasyonu): downloads an original that is already in R2 (`sourceUrl`, e.g.
 * https://images.onopostore.com/<key>, which allows CORS) and stores the given missing `widths` of it.
 * Shares the upload queue, so only one full-size image is decoded at a time. Never throws.
 * `failed.reason`: 'no-webp', 'download' / 'download-<status>', 'decode', 'encode', 'upload' or the
 * upload's HTTP status.
 */
export function createMissingVariants(sourceUrl: string, key: string, widths: readonly number[], options: VariantOptions = {}): Promise<VariantResult> {
    const run = async (): Promise<VariantResult> => {
        const first = widths[0] ?? IMAGE_VARIANT_WIDTHS[0]
        if (typeof createImageBitmap !== 'function' || !(await canEncodeWebp())) {
            return { stored: [], failed: { width: first, reason: 'no-webp' } }
        }
        let blob: Blob
        try {
            const res = await fetch(sourceUrl)
            if (!res.ok) return { stored: [], failed: { width: first, reason: `download-${res.status}` } }
            blob = await res.blob()
        } catch {
            return { stored: [], failed: { width: first, reason: 'download' } }
        }
        let bitmap: ImageBitmap
        try {
            bitmap = await createImageBitmap(blob)
        } catch {
            return { stored: [], failed: { width: first, reason: 'decode' } }
        }
        try {
            return await uploadVariantsFromBitmap(bitmap, key, widths, options)
        } catch {
            return { stored: [], failed: { width: first, reason: 'upload' } }
        } finally {
            bitmap.close()
        }
    }
    const job = queue.then(run)
    queue = job.then(() => { }, () => { })
    return job
}
