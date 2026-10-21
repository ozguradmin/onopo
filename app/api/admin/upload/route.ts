import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// Resized WebP copies made in the admin's browser (lib/imageVariants.ts) are stored next to the
// original as v/<width>/<originalKey>.webp
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
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '')}`

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

        await bucket.put(filename, buffer, {
            httpMetadata: {
                contentType: file.type,
            }
        })

        // Return the proxy URL
        const url = `/api/images/${filename}`

        return NextResponse.json({ success: true, url })

    } catch (error: any) {
        console.error("Upload error", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
