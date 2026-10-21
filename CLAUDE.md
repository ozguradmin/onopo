# onopostore.com — proje notları (ajanlar için)

Bu repo **herkese açık** (github.com/ozguradmin/onopo). Buraya asla şifre, token, API anahtarı, müşteri verisi
ya da kişisel e-posta yazma. Gizli değerler yalnızca yerel `.env` / `.dev.vars` dosyalarında ve Cloudflare'de durur.

## Ne bu
- **Site:** https://onopostore.com (www dahil) — teknoloji aksesuarı e-ticaret sitesi, Türkçe.
- **Kod:** Next.js 15 (App Router) + React 19 + Tailwind 4, Cloudflare Workers üzerinde OpenNext ile.
- **Cloudflare:** Worker `onopo-app`, D1 veritabanı `onopo-db` (binding `DB`), R2 `onopo-storage` (binding `BUCKET`).
  Hesap ve kaynak ID'leri `wrangler.toml`'da. Giriş noktası `worker.ts` (OpenNext worker'ını sarar + cron).
- **Ödeme:** PayTR (`lib/payment/paytr.ts`). `test_mode` kodda sabit `'0'` → ödemeler **gerçek**.
  Ayarlar `payment_settings` tablosunda; gizli alanlar sadece admin'e döner.
- **E-posta:** Resend (`lib/email.ts`). Admin bildirimi `site_settings.admin_email` adresine gider.
- **E-fatura:** BirFatura "Özel Entegrasyon" (aşağıda).

## Deploy — ÖNEMLİ
- `main`'e her push GitHub Actions'ı tetikler (`.github/workflows/deploy.yml`): OpenNext build → `schema.sql`
  (sadece `CREATE TABLE IF NOT EXISTS`) → `wrangler deploy`. Yani **push = canlıya çıkış**.
  Kullanıcıdan açık onay almadan push etme. Sadece doküman değişikliğinde commit mesajına `[skip ci]` ekle.
- Deploy adımında Cloudflare `assets-upload-session` **10013** hatası verirse geçicidir:
  `gh run rerun <id> -R ozguradmin/onopo --failed`.
- Deploy sonrası doğrulama: `curl https://onopostore.com/` içindeki `_next/static/<BUILD_ID>/` yeni build'le eşleşmeli,
  `/api/health` 200, korumalı admin uçları girişsiz 401.

## Yerel kurulum
- `npm ci --legacy-peer-deps`
- `.env` (gitignore'da): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, R2 anahtarları, `RESEND_API_KEY`, `NEXT_PUBLIC_BASE_URL`.
  Wrangler'ı bu token ile çalıştır (OAuth girişine gerek yok):
  `set -a; . ./.env; set +a; node node_modules/wrangler/bin/wrangler.js whoami`
- `.dev.vars` (gitignore'da): yerel worker için `BIRFATURA_TOKEN`.
- Build: `npx opennextjs-cloudflare build` → yerel çalıştırma: `npx wrangler dev --local --port 8811`.
  Başka bir `wrangler dev` aynı portu tutuyorsa istekler eski build'e gider; boş port kullan.
- `tsc` `components/products/ProductsClient.tsx`'te eski tip hataları verir; `next.config.ts` build'de tip hatalarını yok sayar.

## Gizli değişkenler (sadece adlar)
- Cloudflare Worker secret'ları: `BIRFATURA_TOKEN`, `CRON_SECRET`, `JWT_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`.
- GitHub Actions secret'ları: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
- Kullanıcı kararı (2026-10-15): mevcut anahtarlar **yenilenmeyecek**. Resend anahtarı eski git geçmişinde görünür; risk biliniyor.

## Veritabanı (D1) kuralları
- Canlı veri: ~118 aktif ürün, siparişler, kullanıcılar, sayfalar, ayarlar. **Silme/üzerine yazma yapma.**
  Değişiklikten önce yedek: `wrangler d1 export onopo-db --remote --output=backups/backup-<tarih>.sql` (`backups/` gitignore'da, müşteri verisi içerir).
  D1 Time Travel ile 30 gün geri dönülebilir.
- `created_at` UTC (`CURRENT_TIMESTAMP`). Türkiye saati = UTC+3.
- `orders.shipping_address` JSON: `fullName, phone, address, city, district, postalCode, note, tcIdentity,
  wantsDifferentBillingAddress, billingAddress, billingCity, billingDistrict, provider, shipping_cost`.
  Satırlar `order_items` tablosunda (yedek olarak `orders.items` JSON).
- Sipariş durumları: `pending, approved (ödendi), processing, shipped, completed, cancelled`.
  PayTR callback başarıda `approved/paid`, hatada `cancelled/failed` yapar.
- Fatura sütunları: `orders.invoice_url, invoice_no, invoice_date` (BirFatura doldurur).
- Şema değişiklikleri `app/api/migrations/*` (admin korumalı) ile ya da `ALTER TABLE ... ADD COLUMN` ile eklenmiş; `schema.sql` güncel değil.

## Güvenlik
- Admin kontrolü: `lib/auth.ts` → `requireAdmin()`. Bakım/migration/seed/upload uçlarının hepsi admin istiyor.
- Sipariş tutarı sunucuda D1'den hesaplanır (`app/api/orders/route.ts`); istemcinin gönderdiği fiyat kullanılmaz.
  Ödeme formunda il ve ilçe zorunlu (istemci + sunucu).
- `/api/site-settings` admin olmayana `admin_email` döndürmez; `/api/analytics` GET admin ister.

## Cron
- `wrangler.toml` `crons = ["0 7 * * *"]` (10:00 TR). `worker.ts` `scheduled()` → `/api/cron/update-prices/`
  (`CRON_SECRET` ile). USD fiyatlı ürünleri ve `site_settings.last_exchange_rate/last_exchange_update` günceller.

## BirFatura entegrasyonu
- Kod: `lib/birfatura.ts`, `app/api/birfatura/api/{orderStatus,paymentMethods,orders,orderCargoUpdate,invoiceLinkUpdate}/route.ts`.
- BirFatura panelindeki "Onopo Store" mağazasının site adresi `https://onopostore.com/api/birfatura/`;
  BirFatura sonuna `api/orders` vb. ekler. Sitenin kendi `/api/orders` ucu checkout'a ait olduğu için ayrı yola kondu.
- Yetki: `token` header'ı = `BIRFATURA_TOKEN` (panelde "API Şifresi"). Token yoksa 404, yanlışsa 401.
- Durum ID'leri sabit (BirFatura saklıyor, değiştirme): 1 Onaylandı, 2 Hazırlanıyor, 3 Kargoya Verildi,
  4 Tamamlandı, 5 Beklemede, 6 İptal Edildi. Ödeme: 1 PayTR, 2 iyzico, 3 Havale/EFT.
- Varsayımlar: tüm ürünlerde KDV %20; T.C. kimlik yoksa `SSNTCNo = 11111111111`; stok kodu yoksa `ONOPO-<id>`;
  `payment_status = failed` siparişler gönderilmez. BirFatura varsayılan olarak son 30 günü çeker.
- Doküman: https://developers.birfatura.com/dokuman/ozel-entegrasyon-api
  (şema JSON'u: https://developers-api.birfatura.com/api/portal/dokumanlar/ozel-entegrasyon-api)
- 2026-10-21 itibarıyla uçtan uca doğrulandı: sipariş çekme ve fatura bağlantısının siteye dönmesi canlıda çalışıyor.

## Bilinen eksikler
- Satışta stok düşmüyor.
- PayTR işlem numarası siparişe kaydedilmiyor (`orders.payment_id` boş).
- Bazı ürünlerin `product_code`'u yok.
- Test ürünü `id 1207` (`TEST-10TL`) pasif; test siparişi `#88` (9,99 TL) faturalandı.
