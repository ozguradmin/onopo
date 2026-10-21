// Browser-only helper for admin image uploads.
// The original upload is unchanged. Afterwards, resized WebP copies are made in the admin's browser
// (canvas / OffscreenCanvas) and stored next to the original in R2 under
//   v/<width>/<originalKey>.webp     e.g. v/400/1773939592857-ONOPOT120.png.webp
// so the storefront can later serve https://images.onopostore.com/v/<width>/<key>.webp instead of
// multi-MB originals. Variant failures are only logged: they never block or fail the save.

export const IMAGE_VARIANT_WIDTHS = [200, 400, 800, 1200] as const
const WEBP_QUALITY = 0.8

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

async function encodeWebp(bitmap: ImageBitmap, maxWidth: number): Promise<Blob | null> {
    // Never upscale: small originals get same-size WebP copies so every width exists
    const width = Math.min(maxWidth, bitmap.width)
    const height = Math.max(1, Math.round(bitmap.height * width / bitmap.width))

    if (typeof OffscreenCanvas !== 'undefined') {
        const canvas = new OffscreenCanvas(width, height)
        const context = canvas.getContext('2d')
        if (!context) return null
        context.drawImage(bitmap, 0, 0, width, height)
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
        return blob.type === 'image/webp' ? blob : null
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    // Browsers without a WebP encoder silently return PNG: skip rather than store a mislabelled file
    return blob && blob.type === 'image/webp' ? blob : null
}

/**
 * Creates and uploads the WebP variants of an image that was just uploaded.
 * Call without awaiting after the original upload succeeded: `void uploadImageVariants(file, result.url)`.
 */
export async function uploadImageVariants(file: File, uploadedUrl: string): Promise<void> {
    try {
        const key = originalKeyFromUrl(uploadedUrl)
        if (!key || !file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') return
        if (typeof createImageBitmap !== 'function') return

        const bitmap = await createImageBitmap(file)
        try {
            for (const width of IMAGE_VARIANT_WIDTHS) {
                const blob = await encodeWebp(bitmap, width)
                if (!blob) return
                const form = new FormData()
                form.append('file', new File([blob], `${width}.webp`, { type: 'image/webp' }))
                form.append('variantOf', key)
                form.append('width', String(width))
                const res = await fetch('/api/admin/upload', { method: 'POST', body: form })
                if (!res.ok) console.warn(`Image variant ${width}px was not stored (${res.status})`)
            }
        } finally {
            bitmap.close()
        }
    } catch (error) {
        console.warn('Image variants were not created:', error)
    }
}
