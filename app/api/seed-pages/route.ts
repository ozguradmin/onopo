import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()

        // Ensure tables exist
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                updated_at DATETIME
            );
        `).run()

        await db.prepare(`
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY,
                page TEXT,
                product_id INTEGER,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `).run()

        const helpContent = `# Yardım Merkezi
Sıkça Sorulan Sorular

## Siparişimi nasıl takip edebilirim?
Sipariş onay e-postanızda yer alan takip numarasıyla kargo firmasının web sitesinden siparişinizi takip edebilirsiniz.

## İade süreci nasıl işliyor?
Ürününüzü teslim aldıktan sonra 14 gün içinde iade talebinde bulunabilirsiniz. Ürünün kullanılmamış ve orijinal ambalajında olması gerekmektedir.

## Ödeme seçenekleri nelerdir?
Kredi kartı, banka kartı ve havale/EFT ile ödeme yapabilirsiniz. Tüm ödemeleriniz 256-bit SSL ile şifrelenmektedir.

## İletişim
Email: destek@onopo.com
Telefon: 0850 123 45 67
Çalışma Saatleri: Hafta içi 09:00 - 18:00`

        // Insert Help Page
        await db.prepare('INSERT OR REPLACE INTO pages (slug, title, content, updated_at) VALUES (?, ?, ?, ?)').bind(
            'help',
            'Yardım Merkezi',
            helpContent,
            new Date().toISOString()
        ).run()

        // Insert Shipping Page
        await db.prepare('INSERT OR REPLACE INTO pages (slug, title, content, updated_at) VALUES (?, ?, ?, ?)').bind(
            'shipping',
            'Kargo ve İade',
            '# Kargo ve Teslimat\n\nSiparişleriniz 24 saat içinde kargoya verilir...',
            new Date().toISOString()
        ).run()

        // Insert Policy Page
        await db.prepare('INSERT OR REPLACE INTO pages (slug, title, content, updated_at) VALUES (?, ?, ?, ?)').bind(
            'policy',
            'Gizlilik Politikası',
            '# Gizlilik Politikası\n\nVerileriniz güvende...',
            new Date().toISOString()
        ).run()

        // Insert Terms Page
        await db.prepare('INSERT OR REPLACE INTO pages (slug, title, content, updated_at) VALUES (?, ?, ?, ?)').bind(
            'terms',
            'Kullanım Koşulları',
            '# Kullanım Koşulları\n\nSiteyi kullanarak...',
            new Date().toISOString()
        ).run()

        return NextResponse.json({ success: true, message: 'Pages seeded' })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
