import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

// GET: List all categories
export async function GET() {
    try {
        const db = await getDB()
        const { results } = await db.prepare('SELECT * FROM categories ORDER BY name').all()
        return NextResponse.json(results || [])
    } catch (error: any) {
        console.error('Categories fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create new category
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { name } = await req.json()

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
        }

        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()

        await db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)')
            .bind(name, slug)
            .run()

        return NextResponse.json({ success: true, name, slug })
    } catch (error: any) {
        if (error.message?.includes('UNIQUE')) {
            return NextResponse.json({ error: 'Category already exists' }, { status: 409 })
        }
        console.error('Category create error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
