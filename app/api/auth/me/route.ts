import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { getDB } from '@/lib/db'



export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const payload = await verifyJWT(token.value)

        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        // Fetch user from database to get full_name and phone
        const db = await getDB()
        const user = await db.prepare(
            'SELECT id, email, full_name, phone, role FROM users WHERE id = ?'
        ).bind(payload.id).first() as any

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                phone: user.phone
            }
        })

    } catch (error: any) {
        console.error('Auth/me error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
