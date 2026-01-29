/**
 * Image Migration Script
 * -----------------------
 * Bu script eski sistemdeki görselleri indirir, optimize eder ve Cloudflare R2'ye yükler.
 * Sonra ürün veritabanını yeni R2 URL'leri ile günceller.
 * 
 * Kullanım: node scripts/migrate-images.js
 * 
 * Gereksinimler (.env dosyasında):
 * - R2_ACCESS_KEY_ID
 * - R2_SECRET_ACCESS_KEY
 * - R2_ENDPOINT
 * - R2_BUCKET_NAME
 * - CLOUDFLARE_ACCOUNT_ID
 */

const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const https = require('https');
const http = require('http');
const path = require('path');
require('dotenv').config();

// R2 Configuration
const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'onopo-storage';
const R2_PUBLIC_URL = `https://pub-${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.dev`;

// Wrangler D1 için API çağrısı
async function getProducts() {
    const { execSync } = require('child_process');
    const result = execSync(
        'npx wrangler d1 execute onopo-db --remote --json --command "SELECT id, name, images FROM products WHERE is_active = 1"',
        { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }
    );
    const data = JSON.parse(result);
    return data[0]?.results || [];
}

async function updateProduct(id, images) {
    const { execSync } = require('child_process');
    const imagesJson = JSON.stringify(images).replace(/"/g, '\\"');
    execSync(
        `npx wrangler d1 execute onopo-db --remote --command "UPDATE products SET images = '${imagesJson}' WHERE id = ${id}"`,
        { encoding: 'utf-8' }
    );
}

// Görsel indirme
function downloadImage(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;

        const request = client.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 30000
        }, (response) => {
            // Redirect takibi
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                return downloadImage(response.headers.location).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`HTTP ${response.statusCode}`));
            }

            const chunks = [];
            response.on('data', chunk => chunks.push(chunk));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });

        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy();
            reject(new Error('Timeout'));
        });
    });
}

// R2'ye yükleme
async function uploadToR2(key, buffer, contentType) {
    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType
    }));

    // Public URL döndür
    return `${R2_PUBLIC_URL}/${key}`;
}

// Görsel optimize etme
async function optimizeImage(buffer) {
    try {
        const optimized = await sharp(buffer)
            .resize(1200, 1200, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .webp({
                quality: 85,
                effort: 4
            })
            .toBuffer();

        return optimized;
    } catch (error) {
        console.error('Sharp error, returning original:', error.message);
        return buffer;
    }
}

// URL'in zaten R2'de olup olmadığını kontrol et
function isR2Url(url) {
    return url.includes('.r2.dev') || url.includes('r2.cloudflarestorage.com');
}

// Ana migrasyon fonksiyonu
async function migrateImages() {
    console.log('\n🚀 Görsel Migrasyon Başlıyor...\n');
    console.log('R2 Endpoint:', process.env.R2_ENDPOINT);
    console.log('Bucket:', BUCKET_NAME);
    console.log('');

    // Ürünleri al
    console.log('📦 Ürünler alınıyor...');
    const products = await getProducts();
    console.log(`   ${products.length} ürün bulundu.\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    for (const product of products) {
        let images = [];
        try {
            images = typeof product.images === 'string'
                ? JSON.parse(product.images)
                : (product.images || []);
        } catch {
            images = [];
        }

        if (images.length === 0) continue;

        console.log(`\n📷 Ürün #${product.id}: ${product.name}`);
        console.log(`   ${images.length} görsel`);

        const newImages = [];
        let productUpdated = false;

        for (let i = 0; i < images.length; i++) {
            const imgUrl = images[i];

            // Zaten R2'de mi?
            if (isR2Url(imgUrl)) {
                console.log(`   ✓ [${i + 1}] Zaten R2'de`);
                newImages.push(imgUrl);
                totalSkipped++;
                continue;
            }

            // Boş veya geçersiz URL
            if (!imgUrl || !imgUrl.startsWith('http')) {
                console.log(`   ⚠ [${i + 1}] Geçersiz URL, atlanıyor`);
                newImages.push(imgUrl);
                continue;
            }

            try {
                // İndir
                process.stdout.write(`   ↓ [${i + 1}] İndiriliyor... `);
                const originalBuffer = await downloadImage(imgUrl);
                console.log(`${(originalBuffer.length / 1024).toFixed(1)} KB`);

                // Optimize et
                process.stdout.write(`   ⚡ [${i + 1}] Optimize ediliyor... `);
                const optimizedBuffer = await optimizeImage(originalBuffer);
                console.log(`${(optimizedBuffer.length / 1024).toFixed(1)} KB`);

                // R2'ye yükle
                const key = `products/${product.id}/image-${i + 1}-${Date.now()}.webp`;
                process.stdout.write(`   ↑ [${i + 1}] R2'ye yükleniyor... `);
                const newUrl = await uploadToR2(key, optimizedBuffer, 'image/webp');
                console.log('✓');

                newImages.push(newUrl);
                productUpdated = true;
                totalMigrated++;

            } catch (error) {
                console.log(`   ✗ [${i + 1}] Hata: ${error.message}`);
                newImages.push(imgUrl); // Orijinali koru
                totalFailed++;
            }
        }

        // Ürünü güncelle
        if (productUpdated) {
            try {
                process.stdout.write(`   💾 Veritabanı güncelleniyor... `);
                await updateProduct(product.id, newImages);
                console.log('✓');
            } catch (error) {
                console.log(`✗ Hata: ${error.message}`);
            }
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 SONUÇ');
    console.log('='.repeat(50));
    console.log(`   ✓ Migre edilen: ${totalMigrated}`);
    console.log(`   → Atlanan (zaten R2'de): ${totalSkipped}`);
    console.log(`   ✗ Başarısız: ${totalFailed}`);
    console.log('='.repeat(50) + '\n');
}

// Çalıştır
migrateImages().catch(error => {
    console.error('\n❌ Kritik hata:', error);
    process.exit(1);
});
