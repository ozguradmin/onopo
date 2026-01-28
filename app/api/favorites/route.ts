import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get user's favorites
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ favorites: [] })
        }

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ favorites: [] })
        }

        const userId = payload.userId || payload.sub || payload.id
        if (!userId) {
            return NextResponse.json({ favorites: [] })
        }

        const db = await getDB()

        // Get favorite product IDs
        const { results } = await db.prepare(`
            SELECT f.product_id, p.id, p.name, p.slug, p.price, p.original_price, p.images, p.category
            FROM favorites f
            JOIN products p ON f.product_id = p.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `).bind(userId).all()

        // Parse images for each product
        const favorites = (results || []).map((p: any) => ({
            ...p,
            images: (() => {
                try { return p.images ? JSON.parse(p.images) : [] }
                catch { return [] }
            })()
        }))

        return NextResponse.json({ favorites })
    } catch (error: any) {
        console.error('Favorites fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Toggle favorite (add or remove)
export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 })
        }

        const userId = payload.userId || payload.sub || payload.id
        if (!userId) {
            return NextResponse.json({ error: 'Kullanıcı bulunamadı' }, { status: 401 })
        }

        const { productId } = await req.json()
        if (!productId) {
            return NextResponse.json({ error: 'Product ID gerekli' }, { status: 400 })
        }

        const db = await getDB()
        const pid = parseInt(String(productId), 10)

        // Check if already favorited
        const { results: existing } = await db.prepare(
            'SELECT id FROM favorites WHERE user_id = ? AND product_id = ?'
        ).bind(userId, pid).all()

        if (existing && existing.length > 0) {
            // Remove from favorites
            await db.prepare(
                'DELETE FROM favorites WHERE user_id = ? AND product_id = ?'
            ).bind(userId, pid).run()

            return NextResponse.json({ favorited: false, message: 'Favorilerden kaldırıldı' })
        } else {
            // Add to favorites
            await db.prepare(
                'INSERT INTO favorites (user_id, product_id) VALUES (?, ?)'
            ).bind(userId, pid).run()

            return NextResponse.json({ favorited: true, message: 'Favorilere eklendi' })
        }
    } catch (error: any) {
        console.error('Favorite toggle error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
