import type { Guide } from '../types'

export const aracSarjGuide: Guide = {
    slug: 'arac-sarj-cihazi-nasil-secilir',
    title: 'Araç şarj cihazı nasıl seçilir?',
    description: 'Araç şarj cihazında toplam güç ile port gücü farkı, USB-C PD, 12V/24V soket ve kablo seçimi: yolda telefonunuzu hızlı şarj etmek için bilmeniz gerekenler.',
    intro: 'Navigasyon açıkken telefonun şarjı hızla düşer ve zayıf bir araç şarj cihazı bu tüketime ancak yetişir. Doğru cihazı seçmek için watt değerine, port türlerine ve aracınızın soketine bakmanız yeterli. Bu rehberde hepsini sırayla ele alıyoruz.',
    datePublished: '2026-10-22',
    dateModified: '2026-10-22',
    sections: [
        {
            id: 'soket',
            heading: 'Aracınızın soketi: 12V ve 24V',
            blocks: [
                { type: 'p', text: 'Araç şarj cihazları çakmaklık soketine takılır. Otomobillerde bu soket genellikle 12 volttur; kamyon ve otobüs gibi ağır vasıtalarda 24 volt olabilir. Ürünün teknik bilgilerinde "Giriş: 12-24V" gibi bir aralık yazıyorsa cihaz iki tür araçta da kullanılabilir.' },
                { type: 'p', text: 'Bazı araçlarda soket, kontak kapalıyken de akım vermeye devam eder. Uzun süre park edecekseniz şarj cihazını çıkarmak, aküyü gereksiz yere yormamak için iyi bir alışkanlıktır.' },
            ],
        },
        {
            id: 'toplam-guc',
            heading: 'Toplam güç ve port gücü aynı şey değil',
            blocks: [
                { type: 'p', text: 'Ürün adındaki 40W ya da 55W gibi değerler çoğu zaman cihazın tüm portlarından aynı anda verebileceği toplam güçtür. Her portun ayrıca kendi sınırı vardır: örneğin USB-C PD port 20W, USB-A port 5 voltta 15-18W verebilir.' },
                { type: 'p', text: 'Bu yüzden teknik bilgilerde port bazındaki değerlere bakın. Tek bir telefonu ne kadar hızlı şarj edeceğini, telefonun takılı olduğu portun gücü belirler. Toplam güç ise aynı anda iki ya da üç cihaz şarj ettiğinizde önem kazanır.' },
                { type: 'tip', text: 'Teknik bilgilerde "PD: 9V/2A" gibi bir satır görürseniz o portun gücünü kendiniz hesaplayabilirsiniz: 9 × 2 = 18W.' },
            ],
        },
        {
            id: 'port-turleri',
            heading: 'USB-C mi, USB-A mı?',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'USB-C (PD) port: iPhone 8 ve sonrası ile yeni Android telefonların hızlı şarjı için gereklidir. Yeni bir cihaz alıyorsanız en az bir USB-C PD port olmasına dikkat edin.',
                        'USB-A port: Eski telefonlar, kulaklık ya da araç kamerası gibi cihazlar ve elinizdeki USB-A kablolar için kullanışlıdır. Quick Charge (QC 3.0) destekli USB-A portlar, uyumlu Android telefonları daha hızlı şarj eder.',
                        'Çift ya da üç port: Yolcularla seyahat ediyorsanız ya da telefonla birlikte tablet şarj ediyorsanız işe yarar.',
                    ],
                },
            ],
        },
        {
            id: 'kac-watt',
            heading: 'Kaç watt gerekli?',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'Tek telefon ve kısa yollar: 20W civarı bir USB-C PD port yeterlidir.',
                        'Navigasyon, müzik ve uzun yol: 30W ve üzeri bir PD port, telefonu kullanırken de şarj seviyesinin yükselmesine yardımcı olur.',
                        'İki telefon ya da telefon ile tablet: 40-55W toplam güç ve en az iki port.',
                    ],
                },
                { type: 'p', text: 'Telefonunuzun desteklediğinden güçlü bir port zarar vermez; telefon ihtiyacı kadar güç çeker. Hızlı şarjın nasıl çalıştığını [hızlı şarj rehberimizde](/rehber/hizli-sarj-nedir-pd-watt-amper/) anlattık.' },
            ],
        },
        {
            id: 'kablo',
            heading: 'Araçta kablo seçimi',
            blocks: [
                { type: 'p', text: 'Araçta kablo uzunluğu önemlidir. Telefon tutucunuz konsolun yakınındaysa 30 cm gibi kısa bir kablo dağınıklığı ve vites koluna dolanmayı önler. Arka koltuktaki yolcular için 1-2 metrelik bir kablo gerekir.' },
                { type: 'p', text: 'Hızlı şarj için kablonun da uygun olması gerekir. USB-C PD porttan iPhone şarj edecekseniz iPhone 14 ve öncesi için USB-C to Lightning, iPhone 15 ve sonrası için USB-C to USB-C kablo kullanın. Kendi kablosuyla gelen araç şarj cihazlarında kablonun ucu telefonunuza uygun olmalıdır.' },
            ],
        },
        {
            id: 'guvenli-kullanim',
            heading: 'Güvenli kullanım',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'Şarj cihazını sokete tam oturtun. Gevşek temas, şarjın kesilip yeniden başlamasına ve ısınmaya yol açabilir.',
                        'Sürüş sırasında kablo takıp çıkarmayın; telefonu yola çıkmadan önce bağlayın.',
                        'Sıcak havada telefonu güneş alan ön camda şarj etmeyin. Aşırı ısınan telefon şarjı yavaşlatır ya da durdurur.',
                        'Kabloyu vites kolunun, el freninin ve pedalların yakınından geçirmeyin.',
                    ],
                },
                { type: 'p', text: 'Bazı modellerde gece soketi bulmayı kolaylaştıran bir LED ışık bulunur. Gövde malzemesi ve tasarımı daha çok tercih meselesidir; seçim yaparken önce port türlerine ve port bazındaki güç değerlerine bakmak en doğrusudur.' },
            ],
        },
    ],
    faq: [
        {
            q: 'Araç şarj cihazı aküyü bitirir mi?',
            a: 'Motor çalışırken hayır. Kontak kapalıyken de akım veren soketlerde, özellikle ışıklı modeller takılı kaldığında az da olsa akım çekebilir. Uzun park öncesinde çıkarmanız önerilir.',
        },
        {
            q: 'iPhone\'u araçta hızlı şarj edebilir miyim?',
            a: 'Evet. USB-C PD portu olan bir araç şarj cihazı ile iPhone 14 ve öncesi için USB-C to Lightning, iPhone 15 ve sonrası için USB-C to USB-C kablo kullanırsanız iPhone araçta da hızlı şarj olur.',
        },
        {
            q: 'Kamyonda kullanılabilir mi?',
            a: 'Teknik bilgilerde giriş voltajı 12-24V ya da daha geniş bir aralık olarak yazıyorsa evet. Yalnızca 12V yazan cihazları 24V sokette kullanmayın.',
        },
        {
            q: 'Navigasyon açıkken şarj neden yavaş artıyor?',
            a: 'Ekran, GPS ve mobil veri birlikte çok güç tüketir; düşük güçlü bir port bu tüketimi ancak karşılar. 20W ve üzeri bir PD port genellikle bu durumu belirgin şekilde iyileştirir.',
        },
    ],
    productsTitle: 'Araç şarj cihazları ve kısa kablolar',
    products: {
        clauses: [
            { facets: ['arac'], q: 'şarj', exclude: ['supurge', 'filtre'] },
            { facets: ['kablo'], q: 'mini', exclude: ['kulaklik', 'kablosuz', 'yazici'] },
        ],
    },
    productMatch: [{ facets: ['arac'], q: 'şarj', exclude: ['supurge', 'filtre'] }],
}
