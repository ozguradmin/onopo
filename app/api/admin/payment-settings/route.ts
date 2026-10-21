import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT, requireAdmin } from '@/lib/auth'
import { cookies } from 'next/headers'

// The answer depends on the auth cookie (admins get the PayTR secrets on this same URL): never cacheable
const NO_STORE = { 'Cache-Control': 'private, no-store' }

export async function GET() {
    try {
        const db = await getDB()

        // No DDL here: the checkout calls this on every visit. The table and its taksit_token column
        // exist in production; on a fresh database the admin's first save (POST below) creates them.
        const settings = await db.prepare('SELECT * FROM payment_settings LIMIT 1').first() as any

        // Storefront (checkout, installment modal) reads this too: only admins get the PayTR secrets
        const isAdmin = !(await requireAdmin())
        if (!isAdmin && settings) {
            const { provider, is_active, merchant_id, taksit_token } = settings
            return NextResponse.json({ provider, is_active, merchant_id, taksit_token }, { headers: NO_STORE })
        }
        return NextResponse.json(settings || {}, { headers: NO_STORE })
    } catch (error: any) {
        console.error('Payment settings GET error:', error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE })
    }
}

export async function POST(req: NextRequest) {
    try {
        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const db = await getDB()

        // Ensure table exists
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS payment_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                provider TEXT DEFAULT 'paytr',
                is_active INTEGER DEFAULT 0,
                api_key TEXT,
                secret_key TEXT,
                merchant_id TEXT,
                merchant_salt TEXT,
                base_url TEXT,
                test_mode INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `).run()

        // Ensure taksit_token column exists (migration; moved here from the public GET)
        try {
            await db.prepare(`ALTER TABLE payment_settings ADD COLUMN taksit_token TEXT`).run()
        } catch (e) {
            // Column already exists, ignore
        }

        // Check if row exists
        const existing = await db.prepare('SELECT id FROM payment_settings LIMIT 1').first()

        if (existing) {
            // Update existing row
            await db.prepare(`
                UPDATE payment_settings 
                SET provider = ?, 
                    is_active = ?, 
                    api_key = ?, 
                    secret_key = ?, 
                    merchant_id = ?, 
                    merchant_salt = ?,
                    base_url = ?,
                    taksit_token = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).bind(
                body.provider || 'paytr',
                body.is_active ? 1 : 0,
                body.api_key || '',
                body.secret_key || '',
                body.merchant_id || '',
                body.merchant_salt || '',
                body.base_url || '',
                body.taksit_token || '',
                (existing as any).id
            ).run()
        } else {
            // Insert new row
            await db.prepare(`
                INSERT INTO payment_settings (provider, is_active, api_key, secret_key, merchant_id, merchant_salt, base_url, taksit_token)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                body.provider || 'paytr',
                body.is_active ? 1 : 0,
                body.api_key || '',
                body.secret_key || '',
                body.merchant_id || '',
                body.merchant_salt || '',
                body.base_url || '',
                body.taksit_token || ''
            ).run()
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Payment settings POST error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
