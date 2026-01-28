import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: List all reviews (admin only)
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const db = await getDB()
        const { results } = await db.prepare(`
            SELECT r.*, u.full_name as user_name, u.email as user_email, p.name as product_name
            FROM reviews r 
            LEFT JOIN users u ON r.user_id = u.id 
            LEFT JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC
        `).all()

        return NextResponse.json(results || [])
    } catch (error: any) {
        console.error('Admin reviews fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
