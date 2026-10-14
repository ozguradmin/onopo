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

        // Fetch user from database
        const db = await getDB()

        // Try with new columns first, fallback to basic columns if they don't exist
        let user: any
        try {
            user = await db.prepare(
                'SELECT id, email, full_name, phone, address, city, district, postal_code, role FROM users WHERE id = ?'
            ).bind(payload.id).first()
        } catch (e) {
            // Fallback to basic columns if new ones don't exist
            user = await db.prepare(
                'SELECT id, email, full_name, phone, address, role FROM users WHERE id = ?'
            ).bind(payload.id).first()
        }

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                phone: user.phone,
                address: user.address || '',
                city: user.city || '',
                district: user.district || '',
                postal_code: user.postal_code || ''
            }
        })

    } catch (error: any) {
        console.error('Auth/me error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
