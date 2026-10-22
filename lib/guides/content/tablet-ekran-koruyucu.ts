import type { Guide } from '../types'

export const tabletEkranKoruyucuGuide: Guide = {
    slug: 'tablet-ekran-koruyucu-model-kodu-bulma',
    title: 'Tablet ekran koruyucusu: model kodunu bulma',
    description: 'Tablet ekran koruyucusu alırken model adı yetmez. Samsung, iPad ve Huawei tabletlerde model kodunu bulmanın yollarını ve doğru ölçüyü seçmeyi anlattık.',
    intro: 'Tabletlerde aynı adla satılan modeller farklı ekran ölçülerine sahip olabilir. Bu yüzden tablet ekran koruyucusu alırken en güvenilir bilgi cihazın model kodudur. Kodu birkaç adımda bulabilirsiniz; bu rehberde markalara göre nereye bakacağınızı anlatıyoruz.',
    datePublished: '2026-10-22',
    dateModified: '2026-10-22',
    sections: [
        {
            id: 'neden-model-kodu',
            heading: 'Neden model adı yetmiyor?',
            blocks: [
                { type: 'p', text: 'Galaxy Tab, iPad ya da MatePad gibi adlar bir ürün ailesini anlatır. Aynı aile içinde küçük ekranlı modellerden 12 inç ve üzerine kadar farklı ekranlar, farklı kamera ve sensör yerleşimleri bulunur. Bir nesil önceki modelle yenisi aynı adı taşıyıp farklı ölçüde olabilir.' },
                { type: 'p', text: 'Model kodu ise tek bir cihazı tanımlar. Mağazamızdaki tablet koruyucularının adında bu yüzden SM-P615, T720 ya da T870 gibi kodlar yer alır. Kodunuzu ürün adındaki kodla karşılaştırmak, yanlış ürün almanın önüne geçer.' },
            ],
        },
        {
            id: 'samsung',
            heading: 'Samsung Galaxy Tab\'de model kodu',
            blocks: [
                {
                    type: 'ol',
                    items: [
                        'Ayarlar uygulamasını açın.',
                        'En alttaki "Tablet hakkında" bölümüne girin.',
                        '"Model numarası" satırında SM-T870 ya da SM-P615 gibi bir kod görürsünüz.',
                    ],
                },
                { type: 'p', text: 'Kod, cihazın arka yüzündeki küçük yazılarda ve kutunun etiketinde de yer alır. Ürün adlarında kodun başındaki "SM-" kısmı bazen yazılmaz: T870 ile SM-T870 aynı modeldir.' },
                { type: 'p', text: 'Wi-Fi ve hücresel (LTE) sürümlerin kodları genellikle tek bir rakamla ayrılır, örneğin SM-T720 ve SM-T725. Ekran ölçüleri aynı olan sürümler için ürün adında iki kod birlikte yazılır.' },
            ],
        },
        {
            id: 'ipad',
            heading: 'iPad\'de model bilgisi',
            blocks: [
                {
                    type: 'ol',
                    items: [
                        'Ayarlar > Genel > Hakkında bölümünü açın.',
                        '"Model Adı" satırında iPad Air (5. nesil) ya da iPad Pro 11 inç gibi tam adı görürsünüz.',
                        '"Model Numarası" satırına dokunduğunuzda A harfiyle başlayan kod (örneğin A2588) görünür.',
                    ],
                },
                { type: 'p', text: 'iPad\'lerde nesil önemlidir. iPad Pro 11 inç ilk neslinden beri aynı adı taşır, ama son nesilde gövde ölçüleri değişti. Koruyucunun hangi nesillere uyduğunu ürün açıklamasında kontrol edin; emin değilseniz A ile başlayan kodu bize yazın, birlikte kontrol edelim.' },
            ],
        },
        {
            id: 'huawei-ve-digerleri',
            heading: 'Huawei ve diğer tabletler',
            blocks: [
                { type: 'p', text: 'Huawei MatePad ve MediaPad modellerinde model bilgisi Ayarlar > Tablet hakkında bölümündedir; kod AGS2-W09 gibi harf ve rakamlardan oluşur. Diğer Android tabletlerde de benzer bir "Tablet hakkında" ya da "Cihaz hakkında" menüsü bulunur.' },
            ],
        },
        {
            id: 'olcu-kontrolu',
            heading: 'Ölçüyü kontrol etmek',
            blocks: [
                { type: 'p', text: 'Kodu bulamadıysanız ekran ölçüsü ikinci en iyi yoldur. Tablet ekranları inç cinsinden, köşeden köşeye (çapraz) ölçülür; 1 inç 2,54 cm\'dir. Örneğin 10,4 inçlik bir ekranın çaprazı yaklaşık 26,4 cm\'dir.' },
                { type: 'p', text: 'Ancak aynı inçteki iki tabletin en-boy oranı farklı olabilir. Bu yüzden ölçüyü yalnızca kodu doğrulamak için kullanın. Ölçerken dış çerçeveyi değil, ışık veren ekran alanını ölçün.' },
                { type: 'tip', text: 'Kısa yol: Ayarlar\'daki model kodunu ürün adındaki kodla karşılaştırın. Eşleşiyorsa doğru üründesiniz.' },
            ],
        },
        {
            id: 'cerceveli-seramik',
            heading: 'Çerçeveli seramik koruyucular',
            blocks: [
                { type: 'p', text: 'Tablet koruyucularımız seramik yapıdadır ve kenarlarında siyah bir çerçeve bulunur. Çerçeve, ekranın kenarındaki siyah alanla birleşir; böylece koruyucunun kenarı göze batmaz. Seramik koruyucu esnek olduğu için takarken bükmeden, düz tutarak hizalayın.' },
                { type: 'p', text: 'Takma adımları telefondakiyle aynıdır, ancak geniş yüzeye toz daha kolay girer. Temizliği acele etmeden yapın ve koruyucuyu bir kenardan başlayarak yavaşça indirin. Ayrıntılı adımlar için [ekran koruyucu rehberimize](/rehber/ekran-koruyucu-secimi-9d-12d-seramik/) bakabilirsiniz.' },
            ],
        },
        {
            id: 'kontrol-listesi',
            heading: 'Satın almadan önce kısa kontrol listesi',
            blocks: [
                {
                    type: 'ol',
                    items: [
                        'Model kodunu Ayarlar\'dan ya da cihazın arkasından okuyun.',
                        'Kodu ürün adındaki kodla karşılaştırın; "SM-" ön ekini dikkate almayın.',
                        'Ürün adında kod yoksa model adını, nesli ve ekran ölçüsünü birlikte kontrol edin.',
                        'Kalemle kullanıyorsanız ya da kenarları sıkı saran bir kılıfınız varsa bunu da göz önünde bulundurun.',
                        'Hâlâ emin değilseniz model kodunu bize yazın; uyumlu ürünü birlikte bulalım.',
                    ],
                },
                { type: 'p', text: 'Bu birkaç dakikalık kontrol, iade ve yeniden sipariş zahmetinden kurtarır. Doğru koruyucu, tabletinizin ekranını yıllarca ilk günkü gibi tutmanıza yardımcı olur.' },
            ],
        },
    ],
    faq: [
        {
            q: 'Tabletimin model kodunu nerede bulurum?',
            a: 'Samsung ve Huawei\'de Ayarlar > Tablet hakkında, iPad\'de Ayarlar > Genel > Hakkında bölümünde. Kod, cihazın arka yüzünde ve kutu etiketinde de yazar.',
        },
        {
            q: 'Wi-Fi ve LTE sürümleri aynı koruyucuyu kullanır mı?',
            a: 'Çoğu zaman ekran ölçüleri aynıdır, ama her zaman değil. Ürün adında sizin kodunuz yazıyorsa uyumludur; yazmıyorsa satın almadan önce bize sorun.',
        },
        {
            q: 'SM-P615 ile P615 aynı model mi?',
            a: 'Evet. "SM-" Samsung\'un model kodlarının ön ekidir ve ürün adlarında kısaltılabilir.',
        },
        {
            q: 'Tablet ekran koruyucusu kılıfla kullanılır mı?',
            a: 'Evet. Kitap tipi kılıflar ekranın önünü kapattığı için koruyucuyla çoğunlukla sorun çıkarmaz. Kenarları çok sıkı saran kılıflarda önce koruyucuyu, sonra kılıfı takın.',
        },
    ],
    productsTitle: 'Tablet ekran koruyucuları',
    products: {
        clauses: [
            { facets: ['ekran-koruyucu'], q: 'galaxy tab' },
            { facets: ['ekran-koruyucu'], q: 'ipad' },
            { facets: ['ekran-koruyucu'], q: 'çerçeveli' },
        ],
    },
    productMatch: [
        { facets: ['ekran-koruyucu'], q: 'çerçeveli' },
        { facets: ['ekran-koruyucu'], q: 'ipad' },
        { facets: ['ekran-koruyucu'], q: 'galaxy tab' },
        { facets: ['ekran-koruyucu'], q: 'matepad' },
        { facets: ['ekran-koruyucu'], q: 'mediapad' },
    ],
}
