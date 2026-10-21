import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// Combined endpoint: product + reviews + variations in ONE worker invocation.
// The product page is server-rendered now (components/pdp); this public endpoint keeps its response
// shape for any other caller. Inactive products answer 404, like the product page itself.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const db = await getDB()

        // Run all 3 queries with a single getDB() call
        const [productResult, reviewsResult, variationsResult] = await Promise.all([
            db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').bind(id).first(),
            db.prepare(`
                SELECT r.*, u.full_name as user_name 
                FROM reviews r 
                LEFT JOIN users u ON r.user_id = u.id 
                WHERE r.product_id = ? 
                ORDER BY r.created_at DESC
            `).bind(id).all(),
            db.prepare(
                'SELECT * FROM product_variations WHERE product_id = ? ORDER BY name, value'
            ).bind(id).all()
        ])

        if (!productResult) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const product = {
            ...productResult,
            images: productResult.images ? JSON.parse(productResult.images as string) : []
        }

        return NextResponse.json({
            product,
            reviews: reviewsResult.results || [],
            variations: variationsResult.results || []
        }, {
            headers: {
                'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
            }
        })
    } catch (error: any) {
        console.error('Product page data error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
