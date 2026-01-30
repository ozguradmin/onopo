import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'



export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { searchParams } = new URL(req.url)
        const category = searchParams.get('category')

        let sql = 'SELECT id, name, slug, price, original_price, stock, images, category FROM products WHERE is_active = 1'
        const params: any[] = []

        if (category) {
            sql += ' AND (category = ? OR category = ?)'
            params.push(category, category)
        }

        sql += ' ORDER BY id DESC'

        const { results } = params.length > 0
            ? await db.prepare(sql).bind(...params).all()
            : await db.prepare(sql).all()

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

        // Add cache headers for edge caching (60 seconds)
        return NextResponse.json(products, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
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

        if (!name || price === undefined || price === null) {
            console.error('MISSING REQUIRED FIELDS:', { name, price })
            return NextResponse.json({ error: 'Missing required fields: name and price are required' }, { status: 400 })
        }

        // Validate price is a number
        const numericPrice = typeof price === 'number' ? price : parseFloat(String(price))
        if (isNaN(numericPrice)) {
            console.error('INVALID PRICE:', price)
            return NextResponse.json({ error: 'Invalid price value' }, { status: 400 })
        }

        // Generate slug from name (CRITICAL - slug column is NOT NULL)
        // Strip brand name from start and handle Turkish characters
        let nameForSlug = name
            .replace(/^onopo[\s-]*/i, '') // Remove "Onopo" or "Onopo-" from start
            .replace(/^onopo\s+/gi, '') // Remove "ONOPO " from anywhere at start

        const slug = nameForSlug
            .toLowerCase()
            // Replace Turkish characters with ASCII equivalents
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()

        console.log('Generated slug:', slug)

        try {
            // INSERT with slug included
            const result = await db.prepare(
                `INSERT INTO products (
                        name, slug, description, price, original_price, stock, images, category, 
                        is_active, product_code, whatsapp_order_enabled, whatsapp_number
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                name,
                slug,
                description || '',
                numericPrice,
                original_price || null,
                stock || 0,
                JSON.stringify(images || []),
                category || '',
                body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
                body.product_code || '',
                body.whatsapp_order_enabled ? 1 : 0,
                body.whatsapp_number || ''
            ).run()

            console.log('INSERT SUCCESSFUL:', result)

            // Try to update optional columns (separate for compatibility if cols missing)
            const productId = result.meta?.last_row_id
            if (productId && (warranty_info || delivery_info || installment_info)) {
                try {
                    await db.prepare(
                        `UPDATE products SET warranty_info = ?, delivery_info = ?, installment_info = ? WHERE id = ?`
                    ).bind(
                        warranty_info || '',
                        delivery_info || '',
                        installment_info || '',
                        productId
                    ).run()
                } catch (updateError) {
                    console.log('Optional fields update skipped (columns may not exist)')
                }
            }
        } catch (insertError: any) {
            console.error('FATAL INSERT ERROR:', insertError)
            return NextResponse.json({
                error: 'Database Insert Failed',
                message: insertError.message,
                cause: insertError.cause?.message || 'Unknown'
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
