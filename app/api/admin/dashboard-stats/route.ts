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
        const [productsCount, ordersCount, revenue, dayViews, recentOrders] = await Promise.all([
            db.prepare('SELECT COUNT(*) as count FROM products').first(),
            db.prepare('SELECT COUNT(*) as count FROM orders').first(),
            db.prepare('SELECT SUM(total_amount) as total FROM orders WHERE status != "cancelled"').first(),
            db.prepare("SELECT value FROM site_settings WHERE key = 'daily_views_" + new Date().toISOString().split('T')[0] + "'").first(),
            db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 5').all()
        ])

        return NextResponse.json({
            stats: {
                totalProducts: productsCount?.count || 0,
                totalOrders: ordersCount?.count || 0,
                totalRevenue: revenue?.total || 0,
                todayViews: parseInt(dayViews?.value as string || '0')
            },
            recentOrders: recentOrders.results || []
        })

    } catch (error: any) {
        console.error('Dashboard Stats Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
