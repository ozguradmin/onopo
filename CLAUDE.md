# onopostore.com — proje notları (ajanlar için)

Bu repo **herkese açık** (github.com/ozguradmin/onopo). Buraya asla şifre, token, API anahtarı, müşteri verisi
ya da kişisel e-posta yazma. Gizli değerler yalnızca yerel `.env` / `.dev.vars` dosyalarında ve Cloudflare'de durur.

## Ne bu
- **Site:** https://onopostore.com (www ve http, apex'e 301 ile yönlenir; bkz. "Worker") — teknoloji aksesuarı
  e-ticaret sitesi, Türkçe.
- **Kod:** Next.js 16 (App Router) + React 19 + Tailwind 4, Cloudflare Workers üzerinde OpenNext ile.
- **Cloudflare:** Worker `onopo-app`, D1 veritabanı `onopo-db` (binding `DB`), R2 `onopo-storage` (binding `BUCKET`).
  Hesap ve kaynak ID'leri `wrangler.toml`'da. Giriş noktası `worker.ts` (OpenNext worker'ını sarar, aşağıda).
  `workers_dev = false`, `preview_urls = false`: `*.workers.dev` ve önizleme adresleri kapalı; site yalnızca
  onopostore.com / www'den (dashboard'daki custom domain/route) açılır.
- **Ödeme:** PayTR (`lib/payment/paytr.ts`). `test_mode` kodda sabit `'0'` → ödemeler **gerçek**.
  Ayarlar `payment_settings` tablosunda; gizli alanlar sadece admin'e döner.
- **E-posta:** Resend (`lib/email.ts`). Admin bildirimi `site_settings.admin_email` adresine gider.
- **E-fatura:** BirFatura "Özel Entegrasyon" (aşağıda).
- **Ön yüz ve SEO kuralları:** `docs/FRONTEND.md`, `docs/SEO.md`.

## Deploy — ÖNEMLİ
- `main`'e her push GitHub Actions'ı tetikler (`.github/workflows/deploy.yml`): OpenNext build → `schema.sql`
  (canlı DB'de, `continue-on-error`) → `wrangler deploy`. Yani **push = canlıya çıkış**.
  Kullanıcıdan açık onay almadan push etme. Sadece doküman değişikliğinde commit mesajına `[skip ci]` ekle.
- Next.js 16 + OpenNext 1.20 + wrangler 4.151 (Node 22 gerekir; deploy.yml Node 22 kullanır).
  `npm run build` = `next build --webpack`: Turbopack, iyzipay'deki dinamik `require`'ı çözemiyor.
  OpenNext, desteği bitmiş Next sürümlerini build etmez (Next 16'nın desteği 2027-10'da biter).
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
- Yerel build `.env`'i `.open-next` içine gömer. Test için build alınan worktree'nin `.env`'inde yalnızca
  `NEXT_PUBLIC_BASE_URL` bulunsun.
- Yerel `wrangler dev`'e sahte değerler ver ki gerçek anahtarlar hiç kullanılmasın: `--var JWT_SECRET:yerel`,
  `CRON_SECRET`, `RESEND_API_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_API_TOKEN` için de aynısı.
- `--persist-to` yolunu kısa tut: Windows'un 259 karakterlik yol sınırına takılmasın.
- `tsc`, `.next/types` altında ödeme callback route'u için eskiden kalan hatalar verir; `next.config.ts` build'de
  tip hatalarını yok sayar (`ignoreBuildErrors`).
- Birim testleri: `node --test scripts/edge-cache.test.mjs scripts/seo.test.mjs scripts/redirects.test.mjs scripts/guides.test.mjs scripts/worker-hsts.test.mjs` (Node 23.6+; CI çalıştırmaz).
  Otomatik işler: `node --test scripts/automation.test.mjs` (D1 yerine `node:sqlite`, saat/AI/R2/Images sahte).

## Gizli değişkenler (sadece adlar)
- Cloudflare Worker secret'ları: `BIRFATURA_TOKEN`, `CRON_SECRET`, `JWT_SECRET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`;
  isteğe bağlı `ADMIN_RESET_EMAIL` (2FA kodu ve şifre sıfırlama için yedek alıcı, bkz. "Admin girişi").
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
  PayTR callback başarıda `approved/paid`, hatada `cancelled/failed` yapar. Ödenmiş (`payment_status = 'paid'`)
  sipariş bir daha değişmez: tekrar gelen başarı bildirimi bir şey yapmaz, sonradan gelen hata bildirimi iptal
  etmez. Cevap her durumda `OK`.
- Fatura sütunları: `orders.invoice_url, invoice_no, invoice_date` (BirFatura doldurur).
- `schema.sql` yalnızca `CREATE TABLE/INDEX IF NOT EXISTS` içerir ve her deploy'da canlı DB'de çalışır. Varsayılan
  satırlar `scripts/seed-defaults.sql`'de: sadece boş yerel DB için elle çalıştırılır, canlıda asla.
  Son eklenen tablolar: `redirects`, `not_found_log` (eski adres yönlendirmeleri), `system_logs` (Sistem kayıtları).
- **`schema.sql` tam şema değil.** `orders`, `order_items`, `payment_settings`, `shipping_settings`, `coupons`,
  `product_variations`, `two_factor_codes` tabloları ve sonradan eklenen sütunlar (ör. `products.slug`,
  `free_shipping`, `price_usd`) `app/api/migrations/*` (admin korumalı) ya da `ALTER TABLE ... ADD COLUMN` ile
  eklenmiş. Boş bir DB'yi tek başına kuramaz; gerçek şema için canlı DB'ye bak.

## Worker (`worker.ts`, kurallar `lib/edge-cache.ts`)
- **Kanonik host:** `http://` ve `www.` sayfa GET/HEAD istekleri `https://onopostore.com`'a 301 olur. `/api/*` hiç
  yönlenmez (checkout POST'ları, PayTR, BirFatura, Merchant feed). `/sitemap.xml` ve `/robots.txt` istendiği
  host'ta kalır (Akakçe www'den okur; yalnızca http → https).
- **HSTS:** Worker'ın döndürdüğü her HTTPS yanıtına (sayfa, API, cache HIT, 301'ler, 404) `withHsts` ile
  `Strict-Transport-Security: max-age=31536000` eklenir; statik dosyalar `public/_headers`'tan alır. **includeSubDomains
  ve preload yok** (printfast.onopostore.com ayrı bir servis). http yanıtlarına eklenmez.
- **Takip parametreleri** (`utm_*`, `gclid`, `srsltid`, `fbclid`, `msclkid` …) Next'in gördüğü URL'den silinir;
  tarayıcı adresi değişmez. Sunucu kodu bunları okuyamaz.
- **Edge cache** (Workers Cache API): yalnızca anonim (`auth_token` yok) ve allowlist'teki GET'ler (ana sayfa,
  `/products/`, `/kategori/*`, `/page/*`, ürün sayfaları, sitemap/robots, birkaç salt okunur API). TTL 10 dk.
  Anahtar: build id + `site_settings.cache_version` + takip parametresiz URL. Başlık `x-onopo-cache: HIT|MISS|BYPASS`.
  Gövdesinde `data-onopo-nocache=""` olan HTML saklanmaz; `/<slug>/` sadece `id="product-info"` varsa saklanır.
  Oturum açık kullanıcının başarılı içerik yazmaları (ürün, kategori, ayar, sayfa, menü, yükleme …) ve günlük
  fiyat cron'u `cache_version`'ı artırır. Tamamen kapatmak: `lib/edge-cache.ts`'te `EDGE_CACHE_ENABLED = false`
  (kod sabiti; değişiklik + deploy gerekir).
- Anonim allowlist HTML tarayıcıya `Cache-Control: private, no-cache` ile gider (bfcache çalışsın). Oturumlu,
  admin ve ödeme yanıtları kendi başlığını korur.
- **Oturum ipucu:** okunabilir `onopo_oturum=1` çerezi `auth_token` ile senkron tutulur (`lib/session-hint.ts`;
  login, verify-2fa ve logout da kendileri yazar). Sadece ipucudur (header'da "Hesabım", misafire favori GET'i
  atmamak); erişim kararında asla güvenilmez. `/api/birfatura/*` ve `/api/payment/*` yanıtlarına eklenmez.
- **Bakım modu:** bakım render'ı (`data-onopo-maintenance=""` işareti) 503 + `Retry-After: 3600` +
  `X-Robots-Tag: noindex` + `no-store` ile döner; bakımda cache kullanılmaz. `/admin`, `/login`, `/register` ve
  API'ler etkilenmez.
- **Eski adres yönlendirmeleri** (`lib/redirects.ts`, Admin › Yönlendirmeler): Next'in 404'ü (ve `/_next/image`
  hataları, `/api/images/<key>` ıskaları) ziyaretçiye gitmeden önce çözülmeye çalışılır: önce `redirects` tablosu
  (admin), sonra eski platform kalıpları (`/urun/<slug>`, `.html`, `index.php?product_id=`, `/_next/image?url=`,
  eski görsel klasörleri), sonra sıkı bir isim eşleşmesi (emin değilse tahmin yok). Bulunursa tek 301; hedef her
  zaman açılan bir sayfa ya da images.onopostore.com (açık yönlendirme yok, `/api` ve `/admin` hiç yönlenmez).
  Bulunamayanlar `not_found_log`'a (yalnızca yol, sayılar, referrer host; IP/UA yok; Googlebot dışı botlar sayılmaz).
  Ürün/kategori indeksi isolate başına 10 dk tutulur. Testler: `node --test scripts/redirects.test.mjs`.

## Alışveriş rehberleri (`/rehber/`)
- Metinler kodda: `lib/guides/content/*.ts` (6 rehber), slug listesi `lib/guides/slugs.ts`. İlgili ürünler D1'den canlı
  (`lib/guides/server.ts`, en çok 8, stoktakiler önce); metinde fiyat/stok yazılmaz. Metin değişince `dateModified`'i güncelle.
- Ürün sayfasında tek "İlgili rehber" bağlantısı (`guideForProduct`), footer'da "Rehberler", `/kategoriler/`'de blok.
  Sitemap'te var; edge cache allowlist'inde; yönlendirme çözücü `/rehber/` altında tahmin yapmaz. Ayrıntı: `docs/SEO.md` §11.

## Admin girişi ve 2FA
- Admin hesabı `admin@onopo.com` (`lib/login-alias.ts`). Sahip kişisel bir takma adresle (alias) de giriş
  yapabilir; o adres repoda yalnızca SHA-256 özeti olarak durur. **Adresi hiçbir dosyaya yazma.**
- 2FA kodu yazılan alias'a gider; alias yazılmadıysa `ADMIN_RESET_EMAIL` secret'ına, o da yoksa
  `site_settings.admin_email`'e (tek yardımcı fonksiyon, şifre sıfırlamayla aynı sıra). `admin@onopo.com`'a asla
  gitmez; kullanılabilir alıcı yoksa giriş 503 döner. Müşteri girişinde 2FA yok. Admin girişinde IP başına deneme
  sınırı var (D1 tablosu `login_failures`, `CF-Connecting-IP`).
- `/api/auth/login` kodu gönderirken HttpOnly `onopo_2fa` challenge çerezini koyar (Path `/api/auth/`, 5 dk;
  satır `two_factor_challenges`'ta). `/api/auth/verify-2fa` bu çerez olmadan 401 döner. Challenge başına en fazla
  5 deneme (tek koşullu UPDATE ile atomik, sonra 429); kod bir kez kullanılır. verify-2fa'yı doğrudan çağıran
  script'ler bu çerezi taşımalı.
- Şifre sıfırlama bağlantısı (`/api/admin/forgot-password`) da `admin@onopo.com`'a asla gitmez: alias'a (yazılan
  ya da son alias girişinden kayıtlı), yoksa `ADMIN_RESET_EMAIL`'e, yoksa `admin_email`'e. Alıcı yoksa hiçbir şey
  gönderilmez.

## Görseller (`lib/images.ts`)
- Orijinaller R2'de, DB'de `/api/images/<key>` olarak durur; https://images.onopostore.com/<key> üzerinden sunulur.
- Varyantlar: `https://images.onopostore.com/v/<w>/<key>.webp` (w = 200/400/800/1200). **Build sırasında**
  `NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED=true` ile açılır. Henüz kapalı (deploy.yml vermiyor): önce mevcut görsellerin
  varyantları R2'ye yüklenmeli.
- **Varyantlar otomatik** (`lib/image-variants-auto.ts`, `lib/image-variants-server.ts`): Cloudflare Images binding'i
  (`wrangler.toml` `[images] binding = "IMAGES"`). Yükleme uçları (`/api/admin/upload`, `/api/upload`) orijinali
  koyduktan sonra 4 varyantı `ctx.waitUntil` içinde üretir ve `variants: 'server'` döner; o zaman tarayıcı kendi
  kopyalarını yapmaz. Binding yoksa ya da 9422/9432 aldıysa `variants: 'browser'` döner ve eski yol
  (`lib/imageVariants.ts`, admin'in tarayıcısı) çalışır. Logo yüklemesi `transparent=1` gönderir (saydamlık kalır).
  Günlük cron, mağazanın gösterdiği görsellerden (aktif ürünler, aktif hero, görsel kartlar, logo) varyantı eksik
  olanları bulur (`v/<w>/` için R2 list) ve tamamlar (en çok 60 görsel/gün). Var olan varyantın üzerine yazılmaz
  (`If-None-Match: *`). Ücret: ayda tekil (kaynak + parametre) dönüşüm başına; Images Free planında ayda 5.000
  ücretsiz, aşınca yeni dönüşümler 9422 ile reddedilir (ücret yok). Admin › Görsel Optimizasyonu'ndaki tarayıcı
  taraması yedek yol olarak duruyor.
- `FallbackImage` hata olursa bir kez orijinale düşer (sonra placeholder); döngü yok.
- Varyantlar açıkken ürün `og:image`'ı 1200w varyantı, logo 200w/400w kullanır. Feed'ler ve JSON-LD her zaman orijinal.
- Admin yüklemeleri: anahtar `<ms>-<8 hex>-<ad>`, `Cache-Control: public, max-age=31536000, immutable`.

## Güvenlik ve gizlilik
- Admin kontrolü: `lib/auth.ts` → `requireAdmin()`. Bakım/migration/seed/upload uçlarının hepsi admin istiyor.
- Sipariş tutarı sunucuda D1'den hesaplanır (`app/api/orders/route.ts`); istemcinin gönderdiği fiyat kullanılmaz.
  Ödeme formunda il ve ilçe zorunlu (istemci + sunucu). Telefonda 10'dan az rakam varsa `POST /api/orders` 400
  döner; checkout Türk telefon biçimini istemcide doğrular. Pasif ya da stoksuz (`stock <= 0`) ürün 400. Başarı JSON'unda
  `totalAmount` da var (siparişe yazılan ve PayTR'a giden tutar).
- `/api/site-settings` admin olmayana `admin_email` döndürmez; `/api/analytics` GET admin ister.
- Hesaba değil yalnızca `guest_email`'e bağlı siparişler sadece özet gösterir (ad, adres, not, kargo takibi ve
  fatura yok): `/orders/` sayfası (`lib/account.ts`, `detailsHidden`) ve `/api/orders/my-orders` (`details_hidden`).
- Herkese açık yorum yanıtları (`/api/products/<id>/reviews`, `/api/product-page-data/<id>`) maskeli isim verir,
  `user_id` yok. `/api/products/<id>` admin olmayana pasif ürün için 404 döner ve `price_usd` göndermez.

## Admin notları
- `GET /api/products?includeAll=true&includeInactive=true` ve `GET /api/homepage-sections?includeAll=true`, geçerli
  admin çereziyle gizli satırları da döner (`private, no-store`); başka herkes eski yanıtı alır.
- Ürünler kategoriye **adıyla** bağlı (`products.category`). Kategori adı değişince (`PUT /api/categories/<id>`)
  o adı taşıyan ürünler de güncellenir; slug (URL) değişmez. Adı saklayan `site_settings.footer_categories` ve ana
  sayfa bölümü ayarları güncellenmez.
- Yeni kategori slug'ı `slugifyTr()` (`lib/seo.ts`) ile üretilir; Türkçe harfler Latin karşılığına çevrilir.

## Akakçe sözleşmesi
- Ürün sayfasındaki gizli `#product-info` bloğu (`lib/seo.ts` `productInfoHtml`) byte byte aynı kalmalı; tek fark
  `<img id="product-image-N">` etiketlerinin sonundaki ` loading="lazy"`. Product JSON-LD'de `brand` `"ONOPO"` kalır.
  Ayrıntı: `docs/SEO.md` §9.

## Cron
- `wrangler.toml` `crons = ["0 7 * * *"]` (10:00 TR). `worker.ts` `scheduled()` sırayla (hepsi `CRON_SECRET` ile,
  süreç içi `handler.fetch`; bir cron çağrısı en çok 15 dk sürebilir):
  1. Pazartesi: `/api/ai/popular/` (asistanın popüler soruları).
  2. `/api/cron/update-prices/`: USD fiyatlı ürünleri ve `site_settings.last_exchange_rate/last_exchange_update`
     günceller; başarıda `cache_version` artırılır. Hata sistem kaydına yazılır, aşağıdakiler yine çalışır, çağrı en
     sonda hata fırlatır (Cloudflare panelinde "failed" görünsün).
  3. `/api/cron/automation/?job=images` (en çok 4 dk): eksik görsel varyantları.
  4. `/api/cron/automation/?job=facts` (kalan süre, en çok 9 dk): asistanın eksik/eski ürün bilgisi satırları,
     4 sn'de bir DeepSeek çağrısı (hesap sınırı 20/dk, canlı sohbetlere yer kalsın), en çok 120 ürün/gün.

## Asistan ürün bilgileri (otomatik)
- `lib/assistant/facts-auto.ts` + `lib/automation/pacing.ts`. Ürün eklenince/kaydedilince (`POST /api/products`,
  `PUT /api/products/<id>`, toplu içe aktarma) ad + açıklama özeti (hash) değiştiyse satır `ctx.waitUntil` içinde
  hemen yeniden yazılır (en çok 5 ürün/~25 sn; kalanı günlük tarama). Fiyat/stok düzenlemesi model çağırmaz.
- Çağrılar 4 sn arayla başlar, önce sohbetin `CHAT_RL_MODEL` sınırlayıcısından yer alır; 429/3040 gelirse artan
  beklemeyle (10/25/45 sn) yeniden dener; günlük bütçe her çağrıdan önce kontrol edilir. Yalnızca gerçek hata
  (3036 günlük hak, veritabanı, art arda 5 başarısız ürün) işi durdurur.
- `/admin/assistant` "Ürün bilgilerini yenile" düğmesi aynı yolu kullanır (istek başına ~20 sn, sayfa bitene kadar
  tekrarlar; model yoğunsa bekleyip devam eder).

## Sistem kayıtları
- `lib/system-log.ts`, tablo `system_logs`, sayfa `/admin/kayitlar/` (kenar çubuğunda açık hata sayısı, dashboard'da
  uyarı). Otomatik işlerin (asistan ürün bilgileri, görseller, cron) yapamadığı her şey buraya yazılır.
  `logSystemEvent(db, { source, level, message, detail?, ref? })` hiç hata fırlatmaz; aynı kaynak + mesaj + ref
  24 saat içinde tek satırdır (`count`, `last_at`); "Çözüldü" (`resolved_at`) satırı gizler, aynı sorun tekrar
  olursa geri gelir; son görülmesi 90 günden eski satırlar silinir. Müşteri verisi yazılmaz.
- API: `GET/POST /api/admin/system-logs/` (admin). Bu POST ve `/api/admin/assistant/facts/` `cache_version`
  artırmaz (`lib/edge-cache.ts` istisnaları).

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
- Satışta stok düşmüyor (stok elle tutulan bir "satışta" bayrağı; sipariş API'si yalnızca stok > 0'ı kontrol eder).
- PayTR işlem numarası siparişe kaydedilmiyor (`orders.payment_id` boş).
- Bazı ürünlerin `product_code`'u yok.
- Test ürünü `id 1207` (`TEST-10TL`) pasif; test siparişi `#88` (9,99 TL) faturalandı.
- Görsel varyantları R2'de yok; `NEXT_PUBLIC_IMAGE_VARIANTS_ENABLED` kapalı.
- "Çok Satanlar" kategorisinin slug'ı `ok-satanlar` (eski bozuk slugifier); yayından önce `cok-satanlar` yapılmalı (`docs/SEO.md` §10).
