import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export const dynamic = 'force-dynamic'

// GET: List all categories with product count
export async function GET(req: NextRequest) {
    try {
        const db = await getDB()
        const { searchParams } = new URL(req.url)
        const hideEmpty = searchParams.get('hideEmpty') === 'true'

        // Get categories with product count
        let query = `
            SELECT c.*, 
                   (SELECT COUNT(*) FROM products p WHERE (LOWER(p.category) = LOWER(c.slug) OR LOWER(p.category) = LOWER(c.name)) AND p.is_active = 1) as product_count
            FROM categories c 
        `

        if (hideEmpty) {
            query += ` WHERE (SELECT COUNT(*) FROM products p WHERE (LOWER(p.category) = LOWER(c.slug) OR LOWER(p.category) = LOWER(c.name)) AND p.is_active = 1) > 0`
        }

        query += ` ORDER BY c.name`

        const { results } = await db.prepare(query).all()

        // Cache for 5 minutes
        return NextResponse.json(results || [], {
            headers: {
                'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600'
            }
        })
    } catch (error: any) {
        console.error('Categories fetch error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// POST: Create new category
export async function POST(req: NextRequest) {
    try {
        const db = await getDB()
        const { name, icon } = await req.json()

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
        }

        const slug = name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()

        await db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)')
            .bind(name, slug, icon || 'package')
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
