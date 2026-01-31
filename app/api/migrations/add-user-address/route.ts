import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const results: string[] = []

        // Add address column to users table
        try {
            await db.prepare('ALTER TABLE users ADD COLUMN address TEXT').run()
            results.push('Added address column to users table')
        } catch (e: any) {
            if (e.message?.includes('duplicate column') || e.message?.includes('already exists')) {
                results.push('address column already exists in users table')
            } else {
                results.push(`users.address: ${e.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            message: 'User address migration completed',
            logs: results
        })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
