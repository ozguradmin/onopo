/**
 * Review statistics for product cards, listings and the product page (server only).
 *
 * Source: the `reviews` table (id, product_id, user_id, rating 1–5, comment, created_at; since
 * migrations/2026-10-22-guest-reviews.sql also order_id, reviewer_name, verified for reviews written through an
 * order's review link, lib/order-reviews.ts). There is no
 * approval or visibility flag: every row is public (GET /api/products/<id>/reviews lists them all and
 * the admin can only edit or delete), so every row counts here too.
 *
 * Owner decision (2026-10-22): cards and the product page always show a 5-star row. With real reviews
 * they show the real average and count; without reviews they show 5 filled stars, "5,0" and "(0)".
 * JSON-LD gets aggregateRating ONLY from these real numbers (never for count 0).
 *
 *   const stats = await getReviewStatsMap()
 *   <ProductCard product={p} rating={stats.get(p.id) ?? null} />
 */
import 'server-only'
import { cache } from 'react'
import { getDB } from '@/lib/db'

export interface ReviewStats {
    /** Mean rating, 1–5, rounded to one decimal. */
    average: number
    /** Number of reviews (> 0 for every entry in the map). */
    count: number
}

interface D1Like {
    prepare(sql: string): { all<T = Record<string, unknown>>(): Promise<{ results?: T[] }> }
}

/**
 * product_id → { average, count } for every product that has at least one review. One D1 query per
 * request (React cache). Products without reviews are simply absent from the map.
 * Throws when D1 is unavailable; callers that only decorate cards can catch and hide the stars.
 */
export const getReviewStatsMap = cache(async (): Promise<Map<number, ReviewStats>> => {
    const db = (await getDB()) as unknown as D1Like
    const { results } = await db
        .prepare('SELECT product_id, COUNT(*) AS review_count, AVG(rating) AS avg_rating FROM reviews WHERE rating BETWEEN 1 AND 5 GROUP BY product_id')
        .all<{ product_id: number | string; review_count: number | string; avg_rating: number | string | null }>()
    const map = new Map<number, ReviewStats>()
    for (const row of results ?? []) {
        const id = Number(row.product_id)
        const count = Number(row.review_count)
        const avg = Number(row.avg_rating)
        if (!Number.isFinite(id) || !(count > 0) || !Number.isFinite(avg)) continue
        map.set(id, { average: Math.round(Math.min(5, Math.max(1, avg)) * 10) / 10, count })
    }
    return map
})

/** Stats for one product, or null when it has no reviews. */
export async function getReviewStats(productId: number): Promise<ReviewStats | null> {
    return (await getReviewStatsMap()).get(Number(productId)) ?? null
}

/**
 * Same map, or null when D1 fails. For places that only decorate cards (home rails, related products,
 * favourites): without the map, ProductCard simply shows no star row.
 */
export async function getReviewStatsMapSafe(): Promise<Map<number, ReviewStats> | null> {
    try {
        return await getReviewStatsMap()
    } catch (err) {
        console.error('getReviewStatsMap failed, hiding card stars:', err)
        return null
    }
}
