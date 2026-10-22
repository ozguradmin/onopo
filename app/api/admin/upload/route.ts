import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { scheduleUploadVariants } from '@/lib/image-variants-server'

// Resized WebP copies are stored next to the original as v/<width>/<originalKey>.webp. They are made on the
// server right after the upload (Cloudflare Images binding, lib/image-variants-server.ts; the answer then says
// variants: 'server'); otherwise the admin's browser makes them (lib/imageVariants.ts) and posts each one
// here with variantOf. Form field transparent=1 (the logo) keeps transparency instead of flattening on white.
const VARIANT_WIDTHS = [200, 400, 800, 1200]
const VARIANT_SOURCE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,250}$/
const VARIANT_MAX_BYTES = 5 * 1024 * 1024
const IMAGES_ORIGIN = 'https://images.onopostore.com'

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const formData = await req.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
        }

        const buffer = await file.arrayBuffer()
        // Timestamp + random part: two uploads in the same millisecond whose names sanitize to the same
        // string ('ç.png' and 'ş.png' both become '.png') must not overwrite each other. Every upload gets
        // its own key, which is what makes the immutable Cache-Control below safe.
        const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

        // Get bucket via OpenNext
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext()
        const bucket = env.BUCKET

        // Variant upload: only when the form says so; a normal upload (below) is unchanged
        const variantOf = formData.get('variantOf')
        if (variantOf !== null) {
            const width = Number(formData.get('width'))
            if (typeof variantOf !== 'string' || !VARIANT_SOURCE_KEY.test(variantOf) || !VARIANT_WIDTHS.includes(width)) {
                return NextResponse.json({ error: 'Invalid variant' }, { status: 400 })
            }
            if (file.type !== 'image/webp' || buffer.byteLength > VARIANT_MAX_BYTES) {
                return NextResponse.json({ error: 'Variant must be a WebP image under 5 MB' }, { status: 400 })
            }
            if (!(await bucket.head(variantOf))) {
                return NextResponse.json({ error: 'Original image not found' }, { status: 404 })
            }
            const variantKey = `v/${width}/${variantOf}.webp`
            await bucket.put(variantKey, buffer, {
                httpMetadata: {
                    contentType: 'image/webp',
                    // Variant keys are derived from timestamped original keys and never reused
                    cacheControl: 'public, max-age=31536000, immutable',
                }
            })
            return NextResponse.json({ success: true, url: `${IMAGES_ORIGIN}/${variantKey}`, key: variantKey })
        }

        // The variant job reads its own copy: the original's buffer goes to R2 first
        const variantSource = buffer.slice(0)
        await bucket.put(filename, buffer, {
            httpMetadata: {
                contentType: file.type,
                // Served as-is by images.onopostore.com; the key is never reused (see filename above)
                cacheControl: 'public, max-age=31536000, immutable',
            }
        })

        // Return the proxy URL
        const url = `/api/images/${filename}`

        const serverVariants = await scheduleUploadVariants(filename, variantSource, file.type, {
            keepTransparency: formData.get('transparent') === '1',
        })

        return NextResponse.json({ success: true, url, variants: serverVariants ? 'server' : 'browser' })

    } catch (error: any) {
        console.error("Upload error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
