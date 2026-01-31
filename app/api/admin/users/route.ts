import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: List all users (admin only)
export async function GET() {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

        const db = await getDB()
        const { results } = await db.prepare(`
            SELECT id, email, full_name, phone, address, role, created_at
            FROM users 
            ORDER BY created_at DESC
        `).all()

        // Get total count
        const { results: countResult } = await db.prepare('SELECT COUNT(*) as total FROM users').all()
        const total = (countResult?.[0] as any)?.total || 0

        return NextResponse.json({ users: results || [], total })
    } catch (error: any) {
        console.error('Admin users fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
