import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { cookies } from 'next/headers'

// GET: Get all pages
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT * FROM pages ORDER BY slug ASC').all()
        return NextResponse.json(results || [])
    } catch (error: any) {
        console.error('Pages fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
