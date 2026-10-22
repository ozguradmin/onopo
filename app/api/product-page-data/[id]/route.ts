import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { listProductReviews, type PublicReview, type ReviewsDb } from '@/lib/order-reviews'

// Combined endpoint: product + reviews + variations in ONE worker invocation.
// The product page is server-rendered now (components/pdp); this public endpoint keeps its response
// shape for any other caller. Inactive products answer 404, like the product page itself.
// Public data only: reviewer names are masked like on the product page and user_id is not sent (reviews from an
// order's review link carry their stored display name and verified: true);
// the product row has no price_usd (the admin-only USD source price, see /api/products/<id>).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const db = await getDB()

        // Run all 3 queries with a single getDB() call
        const [productResult, reviewsResult, variationsResult] = await Promise.all([
            db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').bind(id).first(),
            listProductReviews(db as unknown as ReviewsDb, Number.parseInt(id, 10) || 0),
            db.prepare(
                'SELECT * FROM product_variations WHERE product_id = ? ORDER BY name, value'
            ).bind(id).all()
        ])

        if (!productResult) {
            return NextResponse.json({ error: 'Product not found' }, { status: 404 })
        }

        const publicProduct: Record<string, unknown> = { ...productResult }
        delete publicProduct.price_usd
        const product = {
            ...publicProduct,
            images: productResult.images ? JSON.parse(productResult.images as string) : []
        }
        const reviews = (reviewsResult as PublicReview[]).map(r => ({
            id: r.id,
            product_id: r.product_id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            user_name: r.author,
            verified: r.verified,
        }))

        return NextResponse.json({
            product,
            reviews,
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
