import type { Guide } from '../types'

export const hizliSarjGuide: Guide = {
    slug: 'hizli-sarj-nedir-pd-watt-amper',
    title: 'Hızlı şarj nedir: PD, watt ve amper',
    description: 'Watt, volt ve amper ne demek? PD, PPS ve Quick Charge farkı ne? Telefonunuzu hızlı şarj etmek için adaptörde ve kabloda nelere bakmanız gerektiğini anlattık.',
    intro: 'Şarj aletlerinin üzerinde 20W, 3A, PD, QC gibi pek çok ifade görürsünüz. Hepsini ezberlemenize gerek yok: birkaç temel kavram, telefonunuza uygun adaptörü ve kabloyu seçmeye yeter.',
    datePublished: '2026-10-22',
    dateModified: '2026-10-22',
    sections: [
        {
            id: 'watt-volt-amper',
            heading: 'Watt, volt ve amper: basit bir hesap',
            blocks: [
                { type: 'p', text: 'Şarj gücü watt (W) ile ölçülür ve basit bir çarpımdır: watt = volt × amper. Volt elektriğin "basıncı", amper ise akan miktar gibi düşünülebilir. Aynı güce düşük voltta yüksek akımla ya da yüksek voltta daha düşük akımla ulaşılabilir.' },
                {
                    type: 'ul',
                    items: [
                        '5V × 2A = 10W: klasik USB şarj hızı.',
                        '9V × 2,22A ≈ 20W: iPhone ve birçok telefonun hızlı şarjı.',
                        '20V × 3,25A = 65W: dizüstü bilgisayar şarj edebilen başlıklar.',
                    ],
                },
                { type: 'p', text: 'Klasik USB-A çıkışlar 5 voltta çalışır. Bu yüzden 3,4A gibi yüksek görünen bir akım bile 5 voltta en fazla 17W eder. Üstelik bu değer çoğu zaman başlıktaki tüm çıkışların toplamıdır.' },
            ],
        },
        {
            id: 'pd-nedir',
            heading: 'PD (Power Delivery) nedir?',
            blocks: [
                { type: 'p', text: 'USB Power Delivery, USB-C üzerinden çalışan ortak bir hızlı şarj standardıdır. Kabloyu taktığınız anda telefon ile adaptör kısa bir "konuşma" yapar: telefon hangi voltu kabul edebileceğini bildirir, adaptör de buna göre 5V, 9V, 15V ya da 20V verir.' },
                { type: 'p', text: 'PD\'nin iyi yanı, iPhone\'lar, Android telefonlar, tabletler ve dizüstü bilgisayarlar dahil pek çok cihazın aynı standardı tanımasıdır. Tek bir güçlü PD başlıkla evdeki birçok cihazı şarj edebilirsiniz.' },
            ],
        },
        {
            id: 'pps-ve-qc',
            heading: 'PPS ve Quick Charge ne demek?',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'PPS (Programmable Power Supply): PD\'nin bir parçasıdır. Voltajı küçük adımlarla ayarlar, böylece telefon şarj olurken daha az ısınır. Samsung\'un 25W ve 45W "Süper Hızlı Şarj" özelliği PPS destekli bir başlık ister.',
                        'Quick Charge (QC): Qualcomm\'un hızlı şarj teknolojisidir ve özellikle USB-A çıkışlı başlıklarda yaygındır. Destekleyen Android telefonlarda USB-A üzerinden de hızlı şarj sağlar.',
                        'Markaya özel teknolojiler: Bazı üreticiler kendi başlık ve kablolarıyla daha yüksek hızlar kullanır. Bu telefonlar standart bir PD başlıkla da şarj olur, ancak markanın en yüksek hızına ulaşmayabilir.',
                    ],
                },
                { type: 'p', text: 'Ürün adında ya da teknik bilgilerde PD, PPS veya QC 3.0 görüyorsanız başlığın hangi teknolojileri desteklediğini anlarsınız. Önemli olan, telefonunuzun desteklediği teknolojiyle eşleşmesidir.' },
            ],
        },
        {
            id: 'gan-nedir',
            heading: 'GaN şarj aleti nedir?',
            blocks: [
                { type: 'p', text: 'GaN (galyum nitrür), şarj aletlerinde silikonun yerine kullanılan bir yarı iletken malzemedir. Daha az ısı ürettiği için aynı gücü daha küçük bir gövdeye sığdırmayı sağlar ve 65W ya da 120W gibi güçlü başlıklarda sık görülür. GaN tek başına telefonu daha hızlı şarj etmez; hızı yine watt değeri ve desteklenen standartlar belirler.' },
            ],
        },
        {
            id: 'kablonun-rolu',
            heading: 'Kablonun rolü',
            blocks: [
                { type: 'p', text: 'Hızlı şarjda kablo da önemlidir. USB-C kabloların çoğu 3 ampere, yani 20 voltta 60W\'a kadar güç taşır. 100W ve üzeri güç için kablonun 5 amper desteklemesi gerekir; bu kablolar içlerindeki küçük bir çiple (e-marker) bunu adaptöre bildirir.' },
                {
                    type: 'ul',
                    items: [
                        'Telefon için 60W\'lık bir USB-C to USB-C kablo fazlasıyla yeterlidir.',
                        'Dizüstü bilgisayar için 100W veya üzeri yazan bir kablo seçin.',
                        'Lightning girişli iPhone\'lar için USB-C to Lightning kablo gerekir; USB-A to Lightning kablolarla PD hızlı şarj olmaz.',
                        'Samsung\'un 45W hızlı şarjı için 5 amper destekli bir USB-C kablo gerekir.',
                    ],
                },
            ],
        },
        {
            id: 'neden-yavasliyor',
            heading: 'Şarj neden bazen yavaşlıyor?',
            blocks: [
                { type: 'p', text: 'Hızlı şarj her zaman aynı hızda sürmez. Telefonlar batarya boşken en yüksek güçle şarj olur; doluluk arttıkça, genellikle yüzde 80\'den sonra, bataryayı korumak için hızı düşürür. Telefon ısındığında da şarj yavaşlar. Şu durumlar da hızı düşürür:' },
                {
                    type: 'ul',
                    items: [
                        'Şarj olurken oyun oynamak ya da navigasyon kullanmak',
                        'Sıcak ortam ve kalın kılıf',
                        'Hasarlı ya da düşük kaliteli kablo',
                        'Çok çıkışlı başlıklarda aynı anda iki cihaz şarj etmek (güç çıkışlar arasında paylaşılır)',
                    ],
                },
                { type: 'p', text: 'Kısacası en hızlı şarj için telefonunuzun desteklediği standartta (çoğu zaman PD) bir başlık, o gücü taşıyabilen bir kablo ve serin bir ortam yeterlidir. iPhone\'a özel ayrıntılar [iPhone şarj rehberimizde](/rehber/iphone-sarj-aleti-ve-kablo-secimi/).' },
            ],
        },
    ],
    faq: [
        {
            q: 'Yüksek watt\'lı şarj aleti telefonumu bozar mı?',
            a: 'Hayır. PD ve QC gibi standartlarda telefon, adaptörden ihtiyacı kadar güç ister. 65W bir başlık, 20W isteyen bir telefona 20W verir.',
        },
        {
            q: 'Telefonum kaç watt destekliyor, nasıl öğrenirim?',
            a: 'Üreticinin teknik özellikler sayfasında kablolu ya da hızlı şarj başlığı altında yazar. Telefonla birlikte bir başlık geldiyse üzerindeki değer de iyi bir ipucudur.',
        },
        {
            q: '3.4A yazan USB şarj aleti hızlı şarj eder mi?',
            a: 'USB-A çıkışlar 5 voltta çalıştığı için 3,4A en fazla 17W eder ve bu değer genellikle çıkışların toplamıdır. Başlıkta QC yazıyorsa ve telefonunuz Quick Charge destekliyorsa daha hızlı şarj olabilir; aksi halde standart hızda şarj olur.',
        },
        {
            q: 'PD ile PPS arasındaki fark nedir?',
            a: 'PPS, PD\'nin bir uzantısıdır: voltajı sabit adımlar yerine küçük aralıklarla ayarlar. Samsung\'un süper hızlı şarjı için PPS gerekir; iPhone\'lar PD ile hızlı şarj olur.',
        },
    ],
    productsTitle: 'Hızlı şarj aletleri ve kablolar',
    products: {
        clauses: [
            { facets: ['sarj-aleti'], q: 'turbo', exclude: ['arac'] },
            { facets: ['kablo', '20w'], q: 'type c', exclude: ['kulaklik', 'kablosuz', 'arac'] },
        ],
    },
    // Every other charger and charging cable ("adaptör" also appears in a gamepad's name, "kablo" in "kablosuz")
    productMatch: [
        { facets: ['sarj-aleti'], exclude: ['arac', 'supurge', 'oyun', 'gamepad'] },
        { facets: ['kablo'], q: 'şarj', exclude: ['kulaklik', 'kablosuz', 'aux', 'supurge', 'yazici'] },
    ],
}
