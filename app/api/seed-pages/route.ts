import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
    try {
        const db = await getDB()

        // Ensure tables exist
        // Initialize pages table
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT,
                content TEXT,
                updated_at DATETIME
            );
        `).run()

        // Initialize analytics table
        await db.prepare(`
            CREATE TABLE IF NOT EXISTS analytics (
                id INTEGER PRIMARY KEY,
                page TEXT,
                product_id INTEGER,
                user_agent TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `).run()

        // PATCH: Ensure products table has new columns
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN warranty_info TEXT").run()
        } catch { }
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN delivery_info TEXT").run()
        } catch { }
        try {
            await db.prepare("ALTER TABLE products ADD COLUMN installment_info TEXT").run()
        } catch { }

        // Better Default Content
        const pages = [
            {
                slug: 'help',
                title: 'Yardım Merkezi',
                content: '# Yardım Merkezi\n\nOnopo Destek ekibi olarak size yardımcı olmaktan mutluluk duyarız. Aşağıdaki konu başlıklarından sorununuzu seçebilir veya bizimle iletişime geçebilirsiniz.\n\n## Sıkça Sorulan Sorular\n\n### Siparişimi nasıl takip edebilirim?\nSiparişlerim sayfasından kargo takibinizi anlık olarak yapabilirsiniz.\n\n### İade süreci nasıl işler?\nÜrün tesliminden itibaren 14 gün içinde ücretsiz iade hakkınız bulunmaktadır.'
            },
            {
                slug: 'shipping',
                title: 'Kargo ve İade',
                content: '# Kargo ve İade Politikası\n\n## Kargo Süreçleri\n\nSiparişleriniz 24 saat içerisinde kargoya verilir. Yurtiçi Kargo güvencesiyle 1-3 iş günü içerisinde adresinize teslim edilir.\n\n### Ücretsiz Kargo\n500 TL ve üzeri tüm alışverişlerinizde kargo ücretsizdir.\n\n## İade Koşulları\n\nSatın aldığınız ürünü beğenmediğiniz takdirde, ambalajı açılmamış olması kaydıyla 14 gün içinde koşulsuz iade edebilirsiniz.'
            },
            {
                slug: 'policy',
                title: 'Gizlilik Politikası',
                content: '# Gizlilik Politikası\n\nOnopo olarak kişisel verilerinizin güvenliğine en üst düzeyde önem veriyoruz. Bu politika, verilerinizin nasıl toplandığını ve kullanıldığını açıklar.\n\n## Toplanan Veriler\n\nSitemizi kullanırken; IP adresi, tarayıcı bilgileri ve alışveriş alışkanlıklarınız gibi veriler, hizmet kalitemizi artırmak amacıyla anonim olarak işlenmektedir.'
            },
            {
                slug: 'terms',
                title: 'Kullanım Koşulları',
                content: '# Kullanım Koşulları\n\nSitemizi ziyaret ederek aşağıdaki koşulları kabul etmiş sayılırsınız.\n\n1. Sitedeki tüm içerik Onopo mülkiyetindedir.\n2. Ticari amaçla izinsiz kullanılamaz.\n3. Fiyat ve stok bilgileri haber verilmeksizin değiştirilebilir.'
            }
        ]

        for (const page of pages) {
            await db.prepare(
                'INSERT OR IGNORE INTO pages (slug, title, content) VALUES (?, ?, ?)'
            ).bind(page.slug, page.title, page.content).run()
        }

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
