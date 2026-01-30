import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { sendTrackingUpdate } from '@/lib/email'

// GET: Get single order
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const db = await getDB()

        const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()
        if (!order) {
            return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
        }

        return NextResponse.json(order)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// PUT: Update order (admin only)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const db = await getDB()
        const body = await req.json()
        const { status, tracking_number, admin_notes, send_notification } = body

        // Get order before update
        const order: any = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first()
        if (!order) {
            return NextResponse.json({ error: 'Sipariş bulunamadı' }, { status: 404 })
        }

        // Build update query
        const updates: string[] = []
        const values: any[] = []

        if (status) {
            updates.push('status = ?')
            values.push(status)
        }
        if (tracking_number !== undefined) {
            updates.push('tracking_number = ?')
            values.push(tracking_number)
        }
        if (admin_notes !== undefined) {
            updates.push('admin_notes = ?')
            values.push(admin_notes)
        }

        if (updates.length > 0) {
            values.push(id)
            await db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...values).run()
        }

        // Send email notification for tracking number
        if (send_notification && tracking_number && order.guest_email) {
            try {
                await sendTrackingUpdate({ id: order.id }, tracking_number, order.guest_email)
            } catch (emailError) {
                console.error('Tracking email sending failed:', emailError)
            }
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Order update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Delete order (admin only)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const db = await getDB()

        // Delete order items first
        await db.prepare('DELETE FROM order_items WHERE order_id = ?').bind(id).run()
        // Delete order
        await db.prepare('DELETE FROM orders WHERE id = ?').bind(id).run()

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Order delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
