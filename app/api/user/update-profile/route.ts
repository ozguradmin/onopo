import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { getDB } from '@/lib/db'

export async function PUT(req: NextRequest) {
    try {
        const token = req.cookies.get('auth_token')

        if (!token) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
        }

        const payload = await verifyJWT(token.value)

        if (!payload) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
        }

        const { phone, address } = await req.json()

        const db = await getDB()

        // Build update query dynamically
        const updates: string[] = []
        const values: any[] = []

        if (phone !== undefined) {
            updates.push('phone = ?')
            values.push(phone)
        }

        if (address !== undefined) {
            updates.push('address = ?')
            values.push(address)
        }

        if (updates.length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
        }

        values.push(payload.id) // For WHERE clause

        await db.prepare(
            `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
        ).bind(...values).run()

        // Fetch updated user
        const user = await db.prepare(
            'SELECT id, email, full_name, phone, address, role FROM users WHERE id = ?'
        ).bind(payload.id).first() as any

        return NextResponse.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                full_name: user.full_name,
                phone: user.phone,
                address: user.address || ''
            }
        })

    } catch (error: any) {
        console.error('Profile update error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
