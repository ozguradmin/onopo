import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT * FROM products ORDER BY created_at DESC').all()

        const products = results.map((p: any) => ({
            ...p,
            images: (() => {
                try {
                    return p.images ? JSON.parse(p.images) : []
                } catch {
                    return []
                }
            })()
        }))

        return NextResponse.json(products)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const db = await getDB()

        // Auth check using correct cookie name
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        console.log('PRODUCT POST RECEIVED:', JSON.stringify(body, null, 2))

        const {
            name,
            description,
            price,
            original_price,
            stock,
            images,
            category,
            warranty_info,
            delivery_info,
            installment_info
        } = body

        if (!name || !price) {
            console.error('MISSING REQUIRED FIELDS:', { name, price })
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
        }

        // FORCE ENSURE COLUMNS EXIST (Runtime Fix)
        try { await db.prepare("ALTER TABLE products ADD COLUMN warranty_info TEXT").run(); } catch { }
        try { await db.prepare("ALTER TABLE products ADD COLUMN delivery_info TEXT").run(); } catch { }
        try { await db.prepare("ALTER TABLE products ADD COLUMN installment_info TEXT").run(); } catch { }

        console.log('PREPARING INSERT STATEMENT...')

        try {
            await db.prepare(
                `INSERT INTO products (name, description, price, original_price, stock, images, category, warranty_info, delivery_info, installment_info) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                name,
                description || '',
                price,
                original_price || null,
                stock || 0,
                JSON.stringify(images || []),
                category || '',
                warranty_info || '',
                delivery_info || '',
                installment_info || ''
            ).run()
            console.log('INSERT SUCCESSFUL')
        } catch (insertError: any) {
            console.error('FATAL INSERT ERROR:', insertError)
            return NextResponse.json({
                error: 'Database Insert Failed',
                message: insertError.message,
                detail: JSON.stringify(insertError)
            }, { status: 500 })
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('PRODUCT POST ERROR:', error)
        // Check for specific D1 errors
        if (error.message?.includes('duplicate column')) {
            return NextResponse.json({ error: 'Database schema conflict (columns already exist)' }, { status: 500 })
        }
        return NextResponse.json({
            error: error.message || 'Internal Server Error',
            stack: error.stack,
            details: JSON.stringify(error)
        }, { status: 500 })
    }
}
