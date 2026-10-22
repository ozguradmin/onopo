import { requireAdmin } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getDB } from '@/lib/db'
import { notifyIndexNow } from '@/lib/indexnow-server'
import { categoryPath } from '@/lib/seo'

type DB = Awaited<ReturnType<typeof getDB>>

// UPDATE statements for the settings that store a category name: site_settings.footer_categories (JSON list)
// and the config.category of 'products' / 'new_products' home sections (same case-insensitive match as the home)
async function renameReferences(db: DB, oldName: string, newName: string) {
    const out = []
    const same = (v: unknown) => typeof v === 'string' && v.toLocaleLowerCase('tr-TR') === oldName.toLocaleLowerCase('tr-TR')

    const footer = await db.prepare("SELECT value FROM site_settings WHERE key = 'footer_categories'").first() as { value?: string } | null
    try {
        const list = JSON.parse(footer?.value || '[]')
        if (Array.isArray(list) && list.some(same)) {
            out.push(db.prepare("UPDATE site_settings SET value = ? WHERE key = 'footer_categories'")
                .bind(JSON.stringify(list.map(v => (same(v) ? newName : v)))))
        }
    } catch {}

    const { results } = await db.prepare(
        "SELECT id, config FROM homepage_sections WHERE type IN ('products', 'new_products') AND config IS NOT NULL"
    ).all() as { results: { id: number; config: string }[] }
    for (const row of results || []) {
        try {
            const cfg = JSON.parse(row.config)
            if (cfg && typeof cfg === 'object' && same(cfg.category)) {
                out.push(db.prepare('UPDATE homepage_sections SET config = ? WHERE id = ?')
                    .bind(JSON.stringify({ ...cfg, category: newName }), row.id))
            }
        } catch {}
    }
    return out
}

// PUT: Update category
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const db = await getDB()
        const { name, icon } = await req.json()

        if (!name) {
            return NextResponse.json({ error: 'Category name is required' }, { status: 400 })
        }

        // Products, the footer category list and category-based home sections point at a category by NAME:
        // a rename moves them along in the same transaction, otherwise the category would lose all its
        // products. The slug (public URL) stays.
        const oldRow = await db.prepare('SELECT name FROM categories WHERE id = ?').bind(id).first() as { name?: string } | null
        const oldName = typeof oldRow?.name === 'string' ? oldRow.name : null
        const statements = [
            db.prepare('UPDATE products SET category = ? WHERE category = (SELECT name FROM categories WHERE id = ?) AND category <> ?')
                .bind(name, id, name),
            db.prepare('UPDATE categories SET name = ?, icon = ? WHERE id = ?')
                .bind(name, icon || 'package', id),
        ]
        if (oldName && oldName !== name) statements.push(...await renameReferences(db, oldName, name))
        await db.batch(statements)
        // The listing shows the new name (its URL stays)
        await notifyIndexNow(req.url, { categories: [name] })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        // categories.name is UNIQUE; the batch rolled back, nothing changed
        if (String(error?.message || '').includes('UNIQUE')) {
            return NextResponse.json({ error: 'Bu adla bir kategori zaten var.' }, { status: 409 })
        }
        console.error('Category update error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Remove category
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const denied = await requireAdmin()
    if (denied) return denied

    try {
        const { id } = await params
        const db = await getDB()

        const gone = await db.prepare('SELECT slug FROM categories WHERE id = ?').bind(id).first<{ slug: string | null }>().catch(() => null)

        await db.prepare('DELETE FROM categories WHERE id = ?')
            .bind(id)
            .run()

        // Its listing no longer answers: the search engines recrawl it and drop it
        if (gone?.slug) await notifyIndexNow(req.url, { paths: [categoryPath(gone.slug)] })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        console.error('Category delete error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
