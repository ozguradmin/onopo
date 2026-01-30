import { NextRequest, NextResponse } from 'next/server'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'
import { getDB } from '@/lib/db'
import { sendCustomEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get('auth_token')?.value

        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const payload = await verifyJWT(token)
        if (!payload || payload.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await req.json()
        const { recipientType, email, emails, subject, message } = body

        if (!subject || !message) {
            return NextResponse.json({ error: 'Konu ve mesaj zorunludur' }, { status: 400 })
        }

        let recipients: string[] = []

        if (recipientType === 'single') {
            if (!email) return NextResponse.json({ error: 'E-posta adresi zorunludur' }, { status: 400 })
            recipients = [email]
        } else if (recipientType === 'all') {
            // Fetch all users + guest emails from orders
            const db = await getDB()

            // Get registered users
            const users = await db.prepare('SELECT email FROM users').all()
            const userEmails = users.results?.map((u: any) => u.email) || []

            // Get guest emails from orders
            const guests = await db.prepare('SELECT DISTINCT guest_email FROM orders WHERE guest_email IS NOT NULL').all()
            const guestEmails = guests.results?.map((g: any) => g.guest_email) || []

            // Merge unique
            recipients = [...new Set([...userEmails, ...guestEmails])]
        } else if (recipientType === 'selected' || recipientType === 'manual') {
            // Emails array passed directly from frontend
            if (!emails || !Array.isArray(emails) || emails.length === 0) {
                return NextResponse.json({ error: 'E-posta adresleri zorunludur' }, { status: 400 })
            }
            recipients = emails
        }

        if (recipients.length === 0) {
            return NextResponse.json({ error: 'Gönderilecek alıcı bulunamadı' }, { status: 404 })
        }

        // Send in batches of 50 to avoid rate limits or timeouts
        const BATCH_SIZE = 50
        for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
            const batch = recipients.slice(i, i + BATCH_SIZE)
            await sendCustomEmail(batch, subject, message)
        }

        return NextResponse.json({
            success: true,
            recipientCount: recipients.length
        })

    } catch (error: any) {
        console.error('Email send error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
