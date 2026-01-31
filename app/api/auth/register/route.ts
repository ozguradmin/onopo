import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { hashPassword, signJWT } from '@/lib/auth'
import { sendWelcomeEmail } from '@/lib/email'



export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { email, password, name, phone, address } = await req.json()

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
        }

        // Check existing user
        const { results } = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).all()
        if (results.length > 0) {
            return NextResponse.json({ error: 'User already exists' }, { status: 409 })
        }

        // Create user
        const hashedPassword = await hashPassword(password)
        const runResult = await db.prepare(
            'INSERT INTO users (email, password_hash, full_name, phone, address, role) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(email, hashedPassword, name || '', phone || '', address || '', 'user').run()

        if (!runResult.success) {
            throw new Error('Failed to create user')
        }

        // Sign Token
        const token = await signJWT({ email, role: 'user' })

        // Send welcome email
        try {
            await sendWelcomeEmail(email)
        } catch (emailError) {
            console.error('Failed to send welcome email:', emailError)
            // Don't fail registration if email fails
        }

        const response = NextResponse.json({ success: true, user: { email, name, role: 'user' } })

        response.cookies.set('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 7 days
        })

        return response

    } catch (error: any) {
        console.error('Registration error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
