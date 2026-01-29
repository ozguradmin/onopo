import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getDB } from '@/lib/db'
import sharp from 'sharp'

// Use Node.js runtime for sharp
export const runtime = 'nodejs'

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

        const { productId } = await req.json()
        if (!productId) return NextResponse.json({ error: 'Missing productId' }, { status: 400 })

        const db = await getDB()
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first()

        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        let images: string[] = []
        try {
            images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || [])
        } catch { images = [] }

        if (images.length === 0) return NextResponse.json({ success: true, optimized: 0 })

        // OpenNext Cloudflare Context
        const { getCloudflareContext } = await import('@opennextjs/cloudflare')
        const { env } = await getCloudflareContext() // This might fail in Node runtime depending on setup
        if (!env?.BUCKET) {
            console.error("BUCKET binding missing")
            // Since we are in Node runtime, bindings might NOT work.
            // We installed @aws-sdk/client-s3. Should use that if bindings fail.
            // But for now, try bindings.
            throw new Error("R2 Bucket binding missing")
        }
        const bucket = env.BUCKET

        let optimizedCount = 0

        for (const imgUrl of images) {
            // Only optimize hosted images
            if (imgUrl.includes('/api/images/')) {
                const key = imgUrl.split('/api/images/')[1]
                if (!key) continue

                try {
                    const object = await bucket.get(key)
                    if (!object) continue

                    const buffer = await object.arrayBuffer()

                    // Sharp Optimization
                    // Resize to HD (1920x1080) max, convert to webp
                    const optimizedBuffer = await sharp(buffer)
                        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
                        .webp({ quality: 80 })
                        .toBuffer()

                    // Put back
                    await bucket.put(key, optimizedBuffer, {
                        httpMetadata: { contentType: 'image/webp' }
                    })
                    optimizedCount++
                } catch (err) {
                    console.error("Opt Error for", key, err)
                }
            }
        }

        return NextResponse.json({ success: true, optimized: optimizedCount })

    } catch (error: any) {
        console.error("Optimize API Error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
