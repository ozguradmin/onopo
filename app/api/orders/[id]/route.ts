import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

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
            // Try to send email notification
            try {
                let address: any = {}
                try { address = JSON.parse(order.shipping_address) } catch { }

                await fetch('https://api.mailchannels.net/tx/v1/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        personalizations: [{ to: [{ email: order.guest_email, name: address.fullName || '' }] }],
                        from: { email: 'no-reply@onopo-app.workers.dev', name: 'Onopo' },
                        subject: `Siparişiniz Kargoya Verildi - #${order.id}`,
                        content: [{
                            type: 'text/html',
                            value: `
                                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                                    <h1 style="color: #1e293b;">Kargo Bilgisi</h1>
                                    <p style="color: #475569;">Merhaba ${address.fullName || ''},</p>
                                    <p style="color: #475569;">#${order.id} numaralı siparişiniz kargoya verildi.</p>
                                    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
                                        <p style="margin: 0;"><strong>Kargo Takip Numarası:</strong></p>
                                        <p style="margin: 8px 0 0 0; font-size: 18px; color: #1e293b;">${tracking_number}</p>
                                    </div>
                                    <p style="color: #64748b; font-size: 14px;">Takip numarası ile kargo firmasının web sitesinden siparişinizi takip edebilirsiniz.</p>
                                </div>
                            `
                        }]
                    })
                })
            } catch (emailError) {
                console.error('Email sending failed:', emailError)
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
