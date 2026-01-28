import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export const runtime = 'edge'

// Security: Check for a setup secret in headers or query params to prevent abuse
// For this recovery phase, we'll use a hardcoded query param that the user can use once
const SETUP_SECRET = 'onopo-admin-setup-2024'

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url)
    const secret = searchParams.get('secret')
    const email = searchParams.get('email') || 'admin@onopo.com'
    const password = searchParams.get('password') || 'admin123'

    if (secret !== SETUP_SECRET) {
        return NextResponse.json({ error: 'Unauthorized: Invalid setup secret' }, { status: 401 })
    }

    try {
        const db = await getDB()

        // 1. Create Tables if they don't exist (Quick recovery measure)
        // Note: Ideally this is done via 'wrangler d1 migrations apply'
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                full_name TEXT,
                avatar_url TEXT,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `).run()

        // 2. Check if admin exists
        const { results } = await db.prepare('SELECT id FROM users WHERE email = ?').bind(email).all()

        if (results.length > 0) {
            // Update to admin role if exists
            await db.prepare('UPDATE users SET role = ?, password_hash = ? WHERE email = ?')
                .bind('admin', await hashPassword(password), email)
                .run()
            return NextResponse.json({ success: true, message: `User ${email} updated to admin.` })
        }

        // 3. Create new Admin
        const hashedPassword = await hashPassword(password)
        await db.prepare(
            'INSERT INTO users (email, password_hash, full_name, role) VALUES (?, ?, ?, ?)'
        ).bind(email, hashedPassword, 'System Admin', 'admin').run()

        return NextResponse.json({ success: true, message: `Admin user ${email} created successfully.` })

    } catch (error: any) {
        console.error('Admin setup error:', error)
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            stack: error.stack
        }, { status: 500 })
    }
}
