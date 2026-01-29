import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getDB } from '@/lib/db'
import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import sharp from 'sharp'

// Use Node.js runtime for sharp
export const runtime = 'nodejs'

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || ''
    }
})

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'onopo-storage'

async function downloadImage(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(30000)
        })
        if (!response.ok) return null
        const arrayBuffer = await response.arrayBuffer()
        return Buffer.from(arrayBuffer)
    } catch (error) {
        console.error('Download error:', error)
        return null
    }
}

async function uploadToR2(key: string, buffer: Buffer, contentType: string): Promise<string | null> {
    try {
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType
        }))
        // Return the public URL (assuming bucket is public or has transform rules)
        return `/api/images/${key}`
    } catch (error) {
        console.error('R2 upload error:', error)
        return null
    }
}

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

        // Check for R2 credentials
        if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
            return NextResponse.json({
                error: 'R2 API credentials not configured. Please add R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY to .env'
            }, { status: 500 })
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

        if (images.length === 0) return NextResponse.json({ success: true, optimized: 0, message: 'No images to optimize' })

        let optimizedCount = 0
        let savedBytes = 0
        const newImages: string[] = []

        for (const imgUrl of images) {
            try {
                // Skip if already optimized (stored in R2)
                if (imgUrl.includes('/api/images/')) {
                    newImages.push(imgUrl)
                    continue
                }

                // Download external image
                const originalBuffer = await downloadImage(imgUrl)
                if (!originalBuffer) {
                    newImages.push(imgUrl) // Keep original if download fails
                    continue
                }

                const originalSize = originalBuffer.length

                // Optimize with Sharp - resize and convert to WebP
                const optimizedBuffer = await sharp(originalBuffer)
                    .resize(1200, 1200, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .webp({
                        quality: 80,
                        effort: 4
                    })
                    .toBuffer()

                const optimizedSize = optimizedBuffer.length
                savedBytes += Math.max(0, originalSize - optimizedSize)

                // Generate unique key
                const key = `products/${productId}/${Date.now()}-${optimizedCount}.webp`

                // Upload to R2
                const newUrl = await uploadToR2(key, optimizedBuffer, 'image/webp')

                if (newUrl) {
                    newImages.push(newUrl)
                    optimizedCount++
                } else {
                    newImages.push(imgUrl) // Keep original if upload fails
                }
            } catch (imgError) {
                console.error('Image optimization error:', imgError)
                newImages.push(imgUrl) // Keep original on error
            }
        }

        // Update product with new image URLs
        if (optimizedCount > 0) {
            await db.prepare(
                'UPDATE products SET images = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
            ).bind(JSON.stringify(newImages), productId).run()
        }

        return NextResponse.json({
            success: true,
            optimized: optimizedCount,
            savedBytes,
            savedMB: (savedBytes / (1024 * 1024)).toFixed(2)
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
        let optimizedImages = 0
        let externalImages = 0

        for (const product of (results || [])) {
            try {
                const images = typeof product.images === 'string' ? JSON.parse(product.images) : (product.images || [])
                totalImages += images.length

                for (const img of images) {
                    if (img.includes('/api/images/')) {
                        optimizedImages++
                    } else {
                        externalImages++
                    }
                }
            } catch { }
        }

        return NextResponse.json({
            totalImages,
            optimizedImages,
            externalImages,
            optimizationRate: totalImages > 0 ? Math.round((optimizedImages / totalImages) * 100) : 0
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
