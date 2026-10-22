import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getActiveProducts, listProducts, type Product } from '@/lib/catalog'
import { prepareQuery, searchItems } from '@/lib/search'

export const dynamic = 'force-dynamic'

const LEGACY_COLUMNS = 'id, name, slug, price, original_price, stock, images, category, free_shipping'

/** Same row shape the paginated listing has always returned (images as the raw JSON string). */
function toLegacyRow(p: Product) {
    return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        original_price: p.original_price,
        stock: p.stock,
        images: JSON.stringify(p.images),
        category: p.category,
        free_shipping: p.free_shipping ? 1 : 0,
    }
}

/** True only for a request carrying a valid admin auth_token (never cached: see includeInactive below). */
async function isAdminSession(): Promise<boolean> {
    const token = (await cookies()).get('auth_token')?.value
    if (!token) return false
    const payload = await verifyJWT(token)
    return !!payload && payload.role === 'admin'
}

/** Rank SQL rows with lib/search (rows carry product_code for matching; it is removed before returning). */
function rankRows(rows: any[], query: string): any[] {
    return searchItems(rows, prepareQuery(query), { soldOutLast: true }).map(({ product_code, ...row }: any) => row)
}

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { searchParams } = new URL(req.url)
        const category = searchParams.get('category')
        const includeAll = searchParams.get('includeAll') === 'true' // Admin flag to include out-of-stock
        // Admin › Ürünler: hidden (is_active = 0) products too, with an is_active field, so they can be found
        // and switched back on. Only with includeAll (never edge-cached) AND a verified admin session;
        // everyone else gets exactly the active-only response.
        const includeInactive = includeAll && searchParams.get('includeInactive') === 'true' && await isAdminSession()
        const slugParam = searchParams.get('slug')
        const exactSlug = searchParams.get('exact') === 'true'
        const searchSlug = searchParams.get('search_slug')
        const query = searchParams.get('q')
        const limit = searchParams.get('limit')
        const hasQuery = query !== null && query.trim() !== ''

        // Single product lookup by exact slug
        if (slugParam && exactSlug) {
            const { results } = await db.prepare(
                `SELECT id, name, slug, price, original_price, stock, images, category, free_shipping FROM products WHERE slug = ? AND is_active = 1 LIMIT 1`
            ).bind(slugParam).all()

            if (results && results.length > 0) {
                const p = results[0] as any
                return NextResponse.json({
                    ...p,
                    images: (() => { try { return p.images ? JSON.parse(p.images) : [] } catch { return [] } })()
                }, {
                    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' }
                })
            }
            return NextResponse.json(null, { status: 404 })
        }

        // Fuzzy slug search for redirect
        if (searchSlug) {
            const cleanSlug = searchSlug.replace('onopo-', '').toLowerCase()
            const tokens = cleanSlug.split('-').filter((w: string) => w.length > 2).slice(0, 3)

            if (tokens.length > 0) {
                const conditions = tokens.map(() => `slug LIKE ?`).join(' AND ')
                const bindValues = tokens.map((w: string) => `%${w}%`)
                const { results } = await db.prepare(
                    `SELECT slug FROM products WHERE is_active = 1 AND (${conditions}) LIMIT 1`
                ).bind(...bindValues).all()

                if (results && results.length > 0) {
                    return NextResponse.json({ slug: (results[0] as any).slug })
                }
            }
            return NextResponse.json(null, { status: 404 })
        }

        // Compact catalogue index for the instant-search dropdown (lib/search runs on it in the browser).
        // All active products, in-stock first; raw prices (display with roundPrice / <Price>).
        if (searchParams.get('index') === '1') {
            const all = await getActiveProducts()
            const ordered = [...all.filter(p => p.in_stock), ...all.filter(p => !p.in_stock)]
            return NextResponse.json(ordered.map(p => ({
                id: p.id,
                name: p.name,
                slug: p.slug,
                category: p.category,
                product_code: p.product_code,
                price: p.price,
                original_price: p.original_price,
                stock: p.stock,
                image: p.image,
                free_shipping: p.free_shipping,
            })), {
                headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' }
            })
        }

        // Storefront listing (paginated object format): the same filtering, search, sorting and counting
        // as the server-rendered listing (lib/catalog listProducts) over the FULL catalogue. Sold-out
        // products are included after the in-stock ones (cards show "Tükendi"), so totals match the
        // category counts. Extra optional params: sort, minPrice, maxPrice, f (facet, repeatable),
        // discounted=true, inStock=true.
        if (!includeAll && searchParams.get('page')) {
            const pageNum = parseInt(searchParams.get('page') || '1', 10)
            const size = Math.min(parseInt(limit || '24', 10) || 24, 200)
            const numParam = (k: string) => {
                const v = searchParams.get(k)
                const n = v === null || v === '' ? NaN : parseFloat(v)
                return Number.isFinite(n) ? n : null
            }
            const result = await listProducts({
                q: query,
                categoryName: category,
                page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
                pageSize: size > 0 ? size : 24,
                sort: searchParams.get('sort'),
                minPrice: numParam('minPrice'),
                maxPrice: numParam('maxPrice'),
                facets: searchParams.getAll('f'),
                onlyDiscounted: searchParams.get('discounted') === 'true',
                inStockOnly: searchParams.get('inStock') === 'true',
            })
            return NextResponse.json({
                products: result.items.map(toLegacyRow),
                totalCount: result.total,
                page: result.page,
                pageSize: result.pageSize,
                totalPages: Math.ceil(result.total / result.pageSize)
            }, {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
                }
            })
        }

        // Base query - only active products, and for customers, hide out-of-stock items
        // (legacy array format: homepage carousels, related products, admin pickers — their cards cannot
        // show a sold-out state, so they keep receiving in-stock products only)
        let sql = includeInactive
            ? `SELECT ${LEGACY_COLUMNS}, is_active${hasQuery ? ', product_code' : ''} FROM products WHERE 1 = 1`
            : `SELECT ${LEGACY_COLUMNS}${hasQuery ? ', product_code' : ''} FROM products WHERE is_active = 1`

        // For customer-facing pages, only show in-stock products
        if (!includeAll) {
            sql += ' AND stock > 0'
        }

        const params: any[] = []

        if (category) {
            sql += ' AND (category = ? OR category = ?)'
            params.push(category, category)
        }

        sql += ' ORDER BY id DESC'

        // Default 24, max 200; a non-numeric or non-positive limit (?limit=abc) means the default
        const parsedLimit = parseInt(limit || '', 10)
        const pageSize = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 24
        const runAll = async (statement: string) => {
            const { results } = params.length > 0
                ? await db.prepare(statement).bind(...params).all()
                : await db.prepare(statement).all()
            return results as any[]
        }

        if (!includeAll) {
            // Legacy format (array) for homepage etc - just apply limit
            if (hasQuery) {
                // Search (?q=) runs in JS with lib/search: Turkish folding, all tokens must match,
                // ranked; a query without a usable token returns [] (never the whole catalogue)
                return NextResponse.json(rankRows(await runAll(sql), query!).slice(0, pageSize), {
                    headers: {
                        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
                    }
                })
            }

            sql += ` LIMIT ${pageSize}`
            return NextResponse.json(await runAll(sql), {
                headers: {
                    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
                }
            })
        }

        // Admin request - return all products without pagination (array format)
        const limitNum = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 0
        if (limitNum > 0 && !hasQuery) sql += ` LIMIT ${limitNum}`

        // CPU Optimization: Return raw data without JSON.parse loop
        // Client handles parsing for better CPU distribution
        let products = await runAll(sql)
        if (hasQuery) {
            products = rankRows(products, query!)
            if (limitNum > 0) products = products.slice(0, limitNum)
        }

        // Admin response - array format for backwards compatibility
        return NextResponse.json(products, {
            headers: {
                // The variant with hidden products is for one admin only: never stored anywhere. An admin's
                // browser must not keep the list either (the dashboard and pickers re-read it after a change)
                'Cache-Control': includeInactive || await isAdminSession() ? 'private, no-store' : 'public, s-maxage=60, stale-while-revalidate=300'
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
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        console.log('PRODUCT POST RECEIVED:', JSON.stringify(body, null, 2))

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
            // INSERT with slug and price_usd included
            const result = await db.prepare(
                `INSERT INTO products (
                        name, slug, description, price, original_price, price_usd, stock, images, category, 
                        is_active, product_code, whatsapp_order_enabled, whatsapp_number
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            ).bind(
                name,
                slug,
                description || '',
                numericPrice,
                original_price || null,
                price_usd || null,
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
