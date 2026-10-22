import type { Guide } from '../types'

export const iphoneSarjGuide: Guide = {
    slug: 'iphone-sarj-aleti-ve-kablo-secimi',
    title: 'iPhone için doğru şarj aleti ve kablo seçimi',
    description: 'iPhone\'unuz Lightning mi USB-C mi? Hızlı şarj için hangi adaptör ve kablo gerekir, kaç watt yeterli? Doğru şarj aleti ve kablo seçimini sade bir dille anlattık.',
    intro: 'iPhone\'a şarj aleti alırken iki soruyu yanıtlamak yeterli: telefonunuzun girişi hangisi ve ne kadar hızlı şarj etmek istiyorsunuz? Bu rehberde girişleri, hızlı şarjın şartlarını ve kablo seçimini adım adım anlatıyoruz.',
    datePublished: '2026-10-22',
    dateModified: '2026-10-22',
    sections: [
        {
            id: 'giris-tipi',
            heading: 'Önce telefonunuzun girişine bakın',
            blocks: [
                { type: 'p', text: 'iPhone\'larda iki farklı giriş var. iPhone 5\'ten iPhone 14 serisine kadar olan modeller Lightning girişi kullanır. iPhone 15 ve sonrasında ise Android telefonlarda da gördüğünüz USB-C girişi bulunur.' },
                {
                    type: 'ul',
                    items: [
                        'iPhone 5 ile iPhone 14 arası (SE modelleri dahil): Lightning',
                        'iPhone 15 ve sonrası: USB-C',
                    ],
                },
                { type: 'p', text: 'Emin değilseniz Ayarlar > Genel > Hakkında ekranındaki model adına bakın ya da kablonun ucunu karşılaştırın. Lightning ucu ince ve düzdür; USB-C ucu biraz daha geniş ve ovaldir. İkisi de ters takılabilir.' },
            ],
        },
        {
            id: 'hizli-sarj-sartlari',
            heading: 'Hızlı şarj için üç şart',
            blocks: [
                { type: 'p', text: 'Apple, iPhone 8 ve sonraki modellerde USB-C Power Delivery (PD) ile hızlı şarjı destekler. Hızlı şarj için üç parçanın birlikte uyumlu olması gerekir:' },
                {
                    type: 'ol',
                    items: [
                        'Telefon: iPhone 8 veya daha yeni bir model.',
                        'Adaptör: USB-C çıkışı olan, PD destekleyen ve en az 20W gücünde bir şarj başlığı.',
                        'Kablo: Lightning girişli modellerde USB-C to Lightning, USB-C girişli modellerde USB-C to USB-C kablo.',
                    ],
                },
                { type: 'p', text: 'Bu üçünden biri eksikse telefon yine şarj olur, ama standart hızda. Örneğin USB-A çıkışlı bir başlık ve USB-A to Lightning kabloyla iPhone, başlığın üzerinde yazan değer ne olursa olsun PD hızlı şarja geçmez. Bu kablolar araçta, bilgisayarda ya da gece boyu şarj için yine kullanışlıdır.' },
                { type: 'tip', text: 'Kısaca: Hızlı şarj istiyorsanız kablonun başlığa takılan ucu USB-C olmalı ve başlıkta PD desteği bulunmalı.' },
            ],
        },
        {
            id: 'kac-watt',
            heading: 'Kaç watt yeterli?',
            blocks: [
                { type: 'p', text: 'Her iPhone modelinin hızlı şarjda çekebileceği güç sınırlıdır ve bu sınır modele göre değişir. 20W bir PD başlık, iPhone 8 ve sonrasındaki tüm modellerde hızlı şarjı başlatır. Yeni modellerde 30W veya daha güçlü bir başlık şarj süresini biraz daha kısaltabilir, ama zorunlu değildir.' },
                { type: 'p', text: 'Daha güçlü bir başlık kullanmak telefona zarar vermez. PD\'de telefon ile adaptör önce anlaşır ve telefon ihtiyacı kadar güç çeker. 67W gibi güçlü bir başlık iPhone\'u daha hızlı şarj etmez, ama aynı başlıkla tablet ya da dizüstü bilgisayar gibi daha çok güç isteyen cihazları da şarj edebilirsiniz.' },
                { type: 'p', text: 'Başlığın etiketine ya da ürün sayfasındaki teknik bilgilere bakın: "PD" ifadesini ve USB-C çıkışında 9V değerini görüyorsanız başlık iPhone\'un hızlı şarjını destekler. Watt, volt ve amperin ne anlama geldiğini [hızlı şarj rehberimizde](/rehber/hizli-sarj-nedir-pd-watt-amper/) anlattık.' },
            ],
        },
        {
            id: 'kablo-secimi',
            heading: 'Kablo seçerken nelere bakmalı?',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'Uçlar: Başlığınız USB-C çıkışlıysa iPhone 14 ve öncesi için USB-C to Lightning, iPhone 15 ve sonrası için USB-C to USB-C kablo seçin. USB-A çıkışlı eski başlıklar için USB-A to Lightning kablo gerekir.',
                        'Uzunluk: Yatak başı ya da koltuk için 2 metre rahat eder. Araçta ve powerbankla 30 cm gibi kısa kablolar dağınıklığı önler. 1 metre çoğu yer için iyi bir ortalamadır.',
                        'Dış yapı: Örgülü kablolar ve uçlardaki sağlam kılıflar, sık bükülen ve çantada taşınan kablolarda daha uzun ömürlüdür.',
                        'Watt değeri: Kablodaki 20W, 30W ya da 60W gibi değerler kablonun taşıyabileceği en yüksek gücü anlatır. Telefon bu değerin altında kaldığı sürece hızı başlık ve telefon belirler.',
                    ],
                },
                { type: 'p', text: 'iPhone 15 ve sonrası için ürün adında "Android" ya da "Samsung" yazan USB-C to USB-C kablolar da kullanılabilir; USB-C ortak bir standarttır. Önemli olan iki ucun da USB-C olması ve kablonun PD hızlı şarjı desteklemesidir.' },
            ],
        },
        {
            id: 'guvenli-kullanim',
            heading: 'Güvenli ve uzun ömürlü kullanım',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'Ucu ya da kılıfı hasar görmüş, içi görünen kabloları kullanmayın.',
                        'Şarj olurken telefonu yastık altı gibi havasız yerlerde bırakmayın. Isınma hem şarjı yavaşlatır hem de bataryayı yorar.',
                        'Kabloyu prizden ya da telefondan çıkarırken kablodan değil, uçtan tutun.',
                        'Ayarlar > Pil bölümündeki optimize edilmiş şarj seçeneğini açık tutun; gece şarjında bataryayı korumaya yardımcı olur.',
                    ],
                },
                { type: 'p', text: 'Telefon şarj olurken çok ısınıyorsa kalın kılıfı çıkarmak ve ekranı kapalı tutmak, şarjın daha düzenli ilerlemesine yardımcı olur.' },
            ],
        },
    ],
    faq: [
        {
            q: 'Android şarj aletiyle iPhone şarj olur mu?',
            a: 'Olur. Başlığın USB-C PD çıkışı varsa ve uygun kabloyu kullanırsanız iPhone hızlı şarj da olur. USB-A çıkışlı başlıklarla iPhone standart hızda şarj olur.',
        },
        {
            q: '20W başlık iPhone 15 için yeterli mi?',
            a: 'Evet. 20W bir PD başlık iPhone 15\'te hızlı şarjı başlatır. Daha güçlü bir başlık şarj süresini bir miktar kısaltabilir, ama gerekli değildir.',
        },
        {
            q: 'Güçlü şarj aleti iPhone\'un bataryasına zarar verir mi?',
            a: 'Hayır. PD kullanan başlıklarda telefon ihtiyacı kadar güç çeker. Bataryayı asıl yoran şey yüksek ısıdır; şarj sırasında telefonu sıcak ortamlarda bırakmayın.',
        },
        {
            q: 'Lightning kablo hangi iPhone modellerinde kullanılır?',
            a: 'iPhone 5\'ten iPhone 14 serisine kadar olan modellerde, SE modelleri dahil. iPhone 15 ve sonrası USB-C kullanır.',
        },
    ],
    productsTitle: 'iPhone için şarj aletleri ve kablolar',
    products: {
        clauses: [
            { facets: ['iphone'], q: 'type c lightning' },
            { facets: ['iphone', 'sarj-aleti'], exclude: ['kulaklik', 'ekran'] },
            { facets: ['iphone'], q: 'şarj başlığı' },
            { facets: ['iphone', 'kablo'], exclude: ['kulaklik', 'ekran'] },
        ],
    },
}
