import { NextRequest, NextResponse } from 'next/server'
import { readJsonBody } from '@/lib/api-request'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { listProductReviews, type ReviewsDb } from '@/lib/order-reviews'

// GET: Get reviews for a product. Public: the reviewer's name is masked like on the product page
// ("Ayşe K.") and user_id is not sent. Reviews written through an order's review link (no account) carry their
// stored display name and `verified: true` (lib/order-reviews.ts).
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const productId = parseInt(id, 10)
        if (!Number.isSafeInteger(productId) || productId <= 0) return NextResponse.json([])
        const db = await getDB()

        const reviews = (await listProductReviews(db as unknown as ReviewsDb, productId)).map(r => ({
            id: r.id,
            product_id: r.product_id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user_name: r.author,
            verified: r.verified,
        }))

        return NextResponse.json(reviews, {
            headers: {
                'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300'
            }
        })
    } catch (error: any) {
        console.error('Reviews fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Add a review (authenticated)
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const db = await getDB()

        // Check authentication
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Giriş yapmanız gerekiyor' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Geçersiz oturum' }, { status: 401 })
        }

        const parsed = await readJsonBody(req)
        if (!parsed.ok) return parsed.response
        const { rating, comment } = parsed.body

        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
        }

        // Validate userId from JWT
        const userId = payload.userId || payload.sub || payload.id
        if (!userId) {
            return NextResponse.json({ error: 'User ID not found in token' }, { status: 401 })
        }

        // Ensure id is a number
        const productId = parseInt(id, 10)
        if (isNaN(productId)) {
            return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 })
        }

        // Check if user already reviewed this product
        const { results: existing } = await db.prepare(
            'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?'
        ).bind(productId, userId).all()

        if (existing && existing.length > 0) {
            return NextResponse.json({ error: 'Bu ürüne zaten yorum yaptınız' }, { status: 409 })
        }

        // Ensure comment is a string, never undefined
        const safeComment = comment != null ? String(comment) : ''
        const safeRating = parseInt(String(rating), 10)

        await db.prepare(
            'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
        ).bind(productId, userId, safeRating, safeComment).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Review create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
