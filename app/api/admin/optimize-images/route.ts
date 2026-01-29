import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getDB } from '@/lib/db'

// Note: This endpoint just validates images - real optimization done via local script

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
        const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(productId).first() as any

        if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

        let images: string[] = []
        try {
            images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || [])
        } catch { images = [] }

        if (images.length === 0) {
            return NextResponse.json({ success: true, optimized: 0, message: 'No images to optimize' })
        }

        // Note: Real image optimization with Sharp doesn't work in Cloudflare Workers
        // Images are already served via CDN with automatic optimization
        // This endpoint now just validates images exist

        let validImages = 0
        const checkedImages: string[] = []

        for (const imgUrl of images) {
            try {
                // Just check if image URL is valid/accessible
                if (imgUrl.startsWith('http')) {
                    const response = await fetch(imgUrl, { method: 'HEAD' })
                    if (response.ok) {
                        validImages++
                        checkedImages.push(imgUrl)
                    }
                } else {
                    // Local image, assume valid
                    validImages++
                    checkedImages.push(imgUrl)
                }
            } catch {
                // Keep the image even if check fails
                checkedImages.push(imgUrl)
            }
        }

        return NextResponse.json({
            success: true,
            totalImages: images.length,
            validImages,
            message: 'Görsel doğrulaması tamamlandı. Cloudflare CDN otomatik optimizasyon sağlar.'
        })

    } catch (error: any) {
        console.error("Optimize API Error:", error)
        return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
    }
}

// GET endpoint to check optimization status
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT id, images FROM products WHERE is_active = 1').all() as any

        let totalImages = 0
        let externalImages = 0

        for (const product of (results || [])) {
            try {
                const images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || [])
                totalImages += images.length

                for (const img of images) {
                    if (img.startsWith('http')) {
                        externalImages++
                    }
                }
            } catch { }
        }

        return NextResponse.json({
            totalImages,
            externalImages,
            message: 'Cloudflare CDN otomatik olarak görsel optimizasyonu sağlar'
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
