import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function PUT(req: NextRequest) {
    try {
        const db = await getDB()
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const { email, password } = await req.json()

        if (password) {
            // Update both email and password
            await db.prepare('UPDATE users SET email = ?, password = ? WHERE id = ?')
                .bind(email, password, payload.userId)
                .run()
        } else {
            // Update only email
            await db.prepare('UPDATE users SET email = ? WHERE id = ?')
                .bind(email, payload.userId)
                .run()
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
