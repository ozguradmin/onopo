import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value
        if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const db = await getDB()

        // Execute queries in parallel for performance
        const [
            productsCount,
            ordersCount,
            revenue,
            pendingCount,
            completedCount,
            cancelledCount,
            avgOrder,
            topProducts,
            categoryStats,
            usersCount,
            recentOrders
        ] = await Promise.all([
            db.prepare('SELECT COUNT(*) as count FROM products').first(),
            db.prepare('SELECT COUNT(*) as count FROM orders').first(),
            db.prepare('SELECT SUM(total_amount) as total FROM orders WHERE status != "cancelled"').first(),
            db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = "pending"').first(),
            db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = "completed"').first(),
            db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = "cancelled"').first(),
            db.prepare('SELECT AVG(total_amount) as avg FROM orders WHERE status != "cancelled"').first(),
            db.prepare(`
                SELECT p.name, SUM(oi.quantity) as sold_count, SUM(oi.quantity * oi.price_at_purchase) as total_revenue
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status != 'cancelled'
                GROUP BY p.id
                ORDER BY sold_count DESC
                LIMIT 10
            `).all(),
            db.prepare(`
                SELECT p.category, COUNT(oi.id) as order_count, SUM(oi.quantity * oi.price_at_purchase) as total_sales
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                JOIN orders o ON oi.order_id = o.id
                WHERE o.status != 'cancelled'
                GROUP BY p.category
                ORDER BY total_sales DESC
            `).all(),
            db.prepare('SELECT COUNT(*) as count FROM users').first(),
            db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all()
        ])

        return NextResponse.json({
            totalProducts: productsCount?.count || 0,
            totalOrders: ordersCount?.count || 0,
            totalRevenue: revenue?.total || 0,
            pendingOrders: pendingCount?.count || 0,
            completedOrders: completedCount?.count || 0,
            cancelledOrders: cancelledCount?.count || 0,
            avgOrderValue: avgOrder?.avg || 0,
            topProducts: topProducts.results || [],
            categoryStats: categoryStats.results || [],
            totalUsers: usersCount?.count || 0,
            recentOrders: recentOrders.results || []
        })

    } catch (error: any) {
        console.error('Dashboard Stats Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
