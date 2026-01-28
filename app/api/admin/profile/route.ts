import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT, hashPassword } from '@/lib/auth'
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

        const userId = payload.userId || payload.sub || payload.id



        // ...

        const { email, password } = await req.json()
        console.log('Profile update attempt for:', email, 'Pass change:', !!password)

        if (password) {
            console.log('Hashing password...')
            const hashedPassword = await hashPassword(password)
            console.log('Password hashed. Updating DB...')

            try {
                // Try updating 'password_hash' column
                await db.prepare('UPDATE users SET email = ?, password_hash = ? WHERE id = ?')
                    .bind(email, hashedPassword, userId)
                    .run()
                console.log('Updated users table (password_hash)')
            } catch (err: any) {
                console.warn('First update failed:', err.message)
                // FALLBACK: If column 'password_hash' not found, try 'password'
                if (String(err).includes('no such column')) {
                    console.warn('Falling back to "password" column')
                    await db.prepare('UPDATE users SET email = ?, password = ? WHERE id = ?')
                        .bind(email, hashedPassword, userId)
                        .run()
                    console.log('Updated users table (password fallback)')
                } else {
                    throw err
                }
            }
        } else {
            // Update only email
            console.log('Updating email only...')
            await db.prepare('UPDATE users SET email = ? WHERE id = ?')
                .bind(email, userId)
                .run()
            console.log('Email updated')
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Profile update error:', error)
        return NextResponse.json({
            error: error.message,
            details: String(error),
            stack: error.stack
        }, { status: 500 })
    }
}
