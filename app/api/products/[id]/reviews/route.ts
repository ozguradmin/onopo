import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get reviews for a product
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const db = await getDB()

        const { results } = await db.prepare(`
            SELECT r.*, u.full_name as user_name 
            FROM reviews r 
            LEFT JOIN users u ON r.user_id = u.id 
            WHERE r.product_id = ? 
            ORDER BY r.created_at DESC
        `).bind(id).all()

        return NextResponse.json(results || [])
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

        const { rating, comment } = await req.json()

        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
        }

        // Check if user already reviewed this product
        const { results: existing } = await db.prepare(
            'SELECT id FROM reviews WHERE product_id = ? AND user_id = ?'
        ).bind(id, payload.userId).all()

        if (existing && existing.length > 0) {
            return NextResponse.json({ error: 'Bu ürüne zaten yorum yaptınız' }, { status: 409 })
        }

        await db.prepare(
            'INSERT INTO reviews (product_id, user_id, rating, comment) VALUES (?, ?, ?, ?)'
        ).bind(id, payload.userId, rating, comment || '').run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Review create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
