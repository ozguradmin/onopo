const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'onopo.db');
const db = new Database(dbPath);

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
Çalışma Saatleri: Hafta içi 09:00 - 18:00`;

try {
    const stmt = db.prepare('INSERT OR REPLACE INTO pages (slug, title, content, updated_at) VALUES (?, ?, ?, ?)');
    stmt.run('help', 'Yardım Merkezi', helpContent, new Date().toISOString());
    console.log('Updated help page content');
} catch (error) {
    console.error('Error updating help page:', error);
}
