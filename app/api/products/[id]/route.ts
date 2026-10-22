import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { runInBackground } from '@/lib/automation/background'
import { refreshFactsForProducts } from '@/lib/assistant/data'
import { notifyIndexNow } from '@/lib/indexnow-server'
import { productPath } from '@/lib/seo'
import { GTIN_NOT_SAVED_WARNING, gtinError, normalizeGtin, writeProductGtin } from '@/lib/gtin'

// Columns only the admin product editor needs (purchase/source prices); never sent to anyone else
const ADMIN_ONLY_COLUMNS = ['price_usd', 'cost', 'cost_price', 'purchase_price', 'buy_price']

// GET: the full row for admins (product editor, inactive products included); for everyone else only an
// active product, without the admin-only columns
export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id

        const token = req.cookies.get('auth_token')?.value
        const isAdmin = token ? (await verifyJWT(token))?.role === 'admin' : false

        const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first()

        if (!product || (!isAdmin && Number(product.is_active) !== 1)) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const row: Record<string, unknown> = { ...product }
        if (!isAdmin) for (const column of ADMIN_ONLY_COLUMNS) delete row[column]

        return NextResponse.json({
            ...row,
            images: product.images ? JSON.parse(product.images as string) : []
        }, {
            headers: {
                // The answer depends on the auth cookie, so no shared cache may keep it (a cached public copy
                // without price_usd reaching the admin editor would blank that field on the next save)
                'Cache-Control': isAdmin ? 'private, no-store' : 'private, no-cache'
            }
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const {
            name,
            description,
            price,
            original_price,
            price_usd,
            stock,
            images,
            category,
            warranty_info,
            delivery_info,
            installment_info,
            is_active,
            product_code,
            whatsapp_order_enabled,
            whatsapp_number,
            free_shipping
        } = body

        // Barcode: only when the form sends the field (quick edits and other callers leave it untouched);
        // empty clears it, anything else must be a valid GTIN-8/12/13/14 (lib/gtin.ts)
        const hasGtin = Object.prototype.hasOwnProperty.call(body, 'gtin')
        const gtinProblem = hasGtin ? gtinError(body.gtin) : null
        if (gtinProblem) return NextResponse.json({ error: gtinProblem }, { status: 400 })

        // Handle USD price - if provided, it takes priority
        const safePriceUsd = price_usd !== undefined && price_usd !== null && price_usd !== ''
            ? parseFloat(price_usd)
            : null

        // Prepare values with safe defaults and type conversions
        const safePrice = parseFloat(price) || 0
        const safeOriginalPrice = original_price ? parseFloat(original_price) : null

        const intId = parseInt(id)
        let safeStock = parseInt(stock) || 0

        // Handle relative stock update if input string starts with + or -
        if (typeof stock === 'string' && (stock.startsWith('+') || stock.startsWith('-'))) {
            const currentProduct = await db.prepare('SELECT stock FROM products WHERE id = ?').bind(intId).first()
            if (currentProduct) {
                safeStock = (currentProduct.stock || 0) + parseInt(stock)
            }
        }

        const safeIsActive = is_active !== undefined ? (is_active ? 1 : 0) : 1
        const safeWhatsappEnabled = whatsapp_order_enabled ? 1 : 0
        const safeWhatsappNumber = whatsapp_number || ''
        const safeFreeShipping = free_shipping ? 1 : 0

        let safeImages = '[]'
        if (typeof images === 'string') {
            safeImages = images // Already stringified or raw string
        } else if (Array.isArray(images)) {
            safeImages = JSON.stringify(images)
        }

        console.log('Updating product:', intId, body)

        // IndexNow: the listing a product leaves (category change) has changed too
        const before = await db.prepare('SELECT category FROM products WHERE id = ?').bind(intId).first<{ category: string | null }>().catch(() => null)

        try {
            await db.prepare(
                `UPDATE products SET 
                 name = ?, description = ?, price = ?, original_price = ?, price_usd = ?, stock = ?, 
                 images = ?, category = ?, warranty_info = ?, delivery_info = ?, installment_info = ?, is_active = ?,
                 product_code = ?, whatsapp_order_enabled = ?, whatsapp_number = ?, free_shipping = ?,
                 updated_at = CURRENT_TIMESTAMP
                 WHERE id = ?`
            ).bind(
                name,
                description || '',
                safePrice,
                safeOriginalPrice,
                safePriceUsd,
                safeStock,
                safeImages,
                category || '',
                warranty_info || '',
                delivery_info || '',
                installment_info || '',
                safeIsActive,
                product_code || '',
                safeWhatsappEnabled,
                safeWhatsappNumber,
                safeFreeShipping,
                intId
            ).run()
        } catch (err: any) {
            // Fallback if is_active column missing
            if (String(err).includes('no such column')) {
                console.warn('is_active column missing, falling back')
                await db.prepare(
                    `UPDATE products SET 
                     name = ?, description = ?, price = ?, original_price = ?, stock = ?, 
                     images = ?, category = ?, warranty_info = ?, delivery_info = ?, installment_info = ?,
                     free_shipping = ?,
                     updated_at = CURRENT_TIMESTAMP
                     WHERE id = ?`
                ).bind(
                    name,
                    description || '',
                    safePrice,
                    safeOriginalPrice,
                    safeStock,
                    safeImages,
                    category || '',
                    warranty_info || '',
                    delivery_info || '',
                    installment_info || '',
                    safeFreeShipping,
                    intId
                ).run()
            } else {
                throw err
            }
        }

        // Separate statement: products.gtin may not exist yet (migrations/2026-10-22-product-gtin.sql)
        let gtinWarning: string | null = null
        if (hasGtin && Number.isInteger(intId) && intId > 0) {
            const stored = await writeProductGtin(db, intId, body.gtin)
            if (stored === 'no_column' && normalizeGtin(body.gtin)) gtinWarning = GTIN_NOT_SAVED_WARNING
        }

        // A changed name or description is re-learned by the assistant right away; other edits cost nothing
        // (the facts line is keyed by a hash of name + description; lib/assistant/facts-auto.ts)
        if (Number.isInteger(intId) && intId > 0) await runInBackground('facts', env => refreshFactsForProducts(env, [intId]))
        // Bing, Yandex & co. recrawl the page and its listing(s) (price, stock, text, deactivation)
        if (Number.isInteger(intId) && intId > 0) await notifyIndexNow(req.url, { productIds: [intId], categories: [before?.category] })

        return NextResponse.json(gtinWarning ? { success: true, warning: gtinWarning } : { success: true })

    } catch (error: any) {
        console.error('Product update error:', error)
        return NextResponse.json({
            error: error.message,
            details: String(error),
            stack: error.stack
        }, { status: 500 })
    }
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
    try {
        const db = await getDB()
        const params = await props.params
        const id = params.id
        const intId = parseInt(id) // Ensure integer

        // Auth check
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // Manual Cascade Delete
        const cleanupQueries = [
            'DELETE FROM order_items WHERE product_id = ?',
            'DELETE FROM favorites WHERE product_id = ?',
            'DELETE FROM featured_products WHERE product_id = ?',
            'DELETE FROM reviews WHERE product_id = ?'
        ]

        for (const query of cleanupQueries) {
            try {
                await db.prepare(query).bind(intId).run()
            } catch (e) {
                console.warn(`Cleanup failed for query: ${query}`, e)
            }
        }

        // Read before the row goes: the search engines are told that its page and its listing changed
        const gone = await db.prepare('SELECT slug, category FROM products WHERE id = ?').bind(intId).first<{ slug: string | null; category: string | null }>().catch(() => null)

        // Finally delete product
        await db.prepare('DELETE FROM products WHERE id = ?').bind(intId).run()

        if (gone) await notifyIndexNow(req.url, { paths: [gone.slug ? productPath(gone.slug) : null, '/products/'], categories: [gone.category] })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('Product delete error:', error)
        return NextResponse.json({
            error: error.message,
            details: String(error)
        }, { status: 500 })
    }
}
