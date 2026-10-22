import type { Guide } from '../types'

export const powerbankGuide: Guide = {
    slug: 'powerbank-secimi-mah-ve-cikis-gucu',
    title: 'Powerbank seçerken mAh ve çıkış gücü',
    description: '10000 mAh mı, 20000 mAh mı? Powerbank telefonu kaç kez şarj eder, çıkış gücü neden önemli, uçağa alınır mı? Powerbank seçerken bilmeniz gerekenleri anlattık.',
    intro: 'Powerbank alırken herkes önce mAh değerine bakar. Oysa telefonunuzu kaç kez ve ne hızda şarj edeceğinizi kapasiteyle birlikte çıkış gücü belirler. Bu rehberde ikisini birlikte değerlendirmeyi, doğru boyutu seçmeyi ve yolculukta dikkat edilecekleri anlatıyoruz.',
    datePublished: '2026-10-22',
    dateModified: '2026-10-22',
    sections: [
        {
            id: 'mah-nedir',
            heading: 'mAh ne anlatır?',
            blocks: [
                { type: 'p', text: 'mAh (miliamper saat), powerbankın içindeki pillerin kapasitesidir. Bu değer pillerin kendi voltajında, genellikle 3,7 voltta ölçülür. Powerbank telefonu şarj ederken voltajı USB\'nin 5 voltuna (hızlı şarjda daha yükseğe) çıkarır ve bu dönüşümde enerjinin bir kısmı ısıya gider.' },
                { type: 'p', text: 'Bu yüzden 10000 mAh bir powerbankın telefona aktarabildiği enerji, etikette yazandan belirgin şekilde azdır. Pratikte etiket kapasitesinin yaklaşık üçte ikisini kullanılabilir kabul etmek gerçekçi bir tahmindir.' },
            ],
        },
        {
            id: 'kac-kez',
            heading: 'Telefonu kaç kez şarj eder?',
            blocks: [
                { type: 'p', text: 'Kaba bir hesap için powerbank kapasitesinin üçte ikisini telefonunuzun batarya kapasitesine bölebilirsiniz. Telefon bataryaları bugün çoğunlukla 3000 ile 5000 mAh arasındadır.' },
                {
                    type: 'ul',
                    items: [
                        '10000 mAh: 4000 mAh bataryalı bir telefonu yaklaşık 1,5 kez doldurur.',
                        '20000 mAh: aynı telefonu yaklaşık 3 kez doldurur.',
                    ],
                },
                { type: 'p', text: 'Telefonu şarj ederken kullanmak, soğuk hava ve yıpranmış bir batarya bu sayıyı düşürür.' },
            ],
        },
        {
            id: 'cikis-gucu',
            heading: 'Çıkış gücü: hız burada belirlenir',
            blocks: [
                { type: 'p', text: 'Çıkış gücü, powerbankın telefona ne kadar hızlı enerji verebildiğini gösterir. Teknik bilgilerde genellikle "Çıkış: 5V/2,1A" gibi yazılır. Gücü bulmak için voltu amperle çarpın: 5 × 2,1 = yaklaşık 10,5W. Bu standart bir şarj hızıdır.' },
                { type: 'p', text: 'Hızlı şarj isteyen telefonlar için USB-C PD çıkışlı powerbanklar 18-22,5W ya da daha fazla güç verir. Ürün adında veya teknik bilgilerde PD ve bir watt değeri yoksa powerbank standart hızda şarj ediyordur.' },
                { type: 'p', text: 'Standart hız her durumda dezavantaj değildir: gece boyunca ya da telefon çantada dururken şarj için yeterlidir. Watt ve amperin ayrıntıları için [hızlı şarj rehberimize](/rehber/hizli-sarj-nedir-pd-watt-amper/) bakabilirsiniz.' },
            ],
        },
        {
            id: 'giris-gucu',
            heading: 'Powerbankın kendisi ne kadar sürede dolar?',
            blocks: [
                { type: 'p', text: 'Powerbankın giriş gücü, kendisinin ne kadar sürede dolacağını belirler. 5V/2A (10W) girişli 20000 mAh bir powerbankın tamamen dolması bir geceyi bulabilir. Akşam şarja takıp sabah almak en pratik kullanımdır.' },
                { type: 'p', text: 'Powerbankı doldururken en az 2A veren bir başlık kullanın; düşük güçlü eski başlıklarla dolum süresi uzar.' },
            ],
        },
        {
            id: '10000-mi-20000-mi',
            heading: '10000 mAh mı, 20000 mAh mı?',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        '10000 mAh: Cepte ya da küçük bir çantada taşınır. Gün içinde bir tam şarj ve biraz fazlası için idealdir.',
                        '20000 mAh: Daha büyük ve ağırdır. Tatil, kamp, uzun yolculuk ya da birden fazla cihaz için uygundur.',
                    ],
                },
                { type: 'p', text: 'Kapasite iki katına çıktığında ağırlık da belirgin şekilde artar. Her gün yanınızda taşıyacaksanız hafif olanı, nadiren ama uzun süre ihtiyaç duyacaksanız büyük olanı seçin.' },
            ],
        },
        {
            id: 'ucak',
            heading: 'Uçakta powerbank',
            blocks: [
                { type: 'p', text: 'Powerbanklar uçakta yalnızca kabin bagajında taşınabilir; bagaja verilemez. Havayolu kuralları kapasiteyi watt saat (Wh) ile sınırlar ve 100 Wh\'e kadar olan powerbanklar genellikle sorunsuz kabul edilir.' },
                { type: 'p', text: 'Wh değerini bulmak için mAh değerini 3,7 ile çarpıp 1000\'e bölün: 10000 mAh yaklaşık 37 Wh, 20000 mAh yaklaşık 74 Wh eder. İkisi de 100 Wh sınırının altındadır. Yine de bazı havayolları uçuş sırasında kullanımı kısıtlayabilir; yolculuktan önce havayolunuzun kurallarına bakın.' },
            ],
        },
        {
            id: 'guvenli-kullanim',
            heading: 'Güvenli kullanım',
            blocks: [
                {
                    type: 'ul',
                    items: [
                        'Şişmiş, çatlamış ya da kullanırken aşırı ısınan bir powerbankı kullanmayı bırakın.',
                        'Powerbankı yaz günü araç içinde ya da doğrudan güneş altında bırakmayın.',
                        'Şarj ederken yastık altı, battaniye gibi havasız yerlere koymayın.',
                        'Düşürdükten sonra ısınma, koku ya da ses fark ederseniz kullanmayın.',
                    ],
                },
                { type: 'p', text: 'Kalan kapasiteyi gösteren LED gösterge, powerbankı ne zaman şarja takmanız gerektiğini bilmek için kullanışlıdır. Gösterge son seviyeye indiğinde şarj etmek, bir sonraki ihtiyacınızda powerbankın hazır olmasını sağlar.' },
            ],
        },
    ],
    faq: [
        {
            q: 'Powerbankı sürekli şarjda bırakmak zararlı mı?',
            a: 'Dolduktan sonra şarjdan çıkarmak en iyisidir. Uzun süre kullanmayacaksanız yarı dolu halde, serin bir yerde saklayın ve birkaç ayda bir şarj edin.',
        },
        {
            q: 'Powerbank tablet şarj eder mi?',
            a: 'Eder, ancak tablet bataryaları büyük olduğu için 10000 mAh bir powerbank çoğu tableti bir kez bile tam doldurmayabilir. Tablet için 20000 mAh ve mümkünse yüksek çıkış gücü tercih edin.',
        },
        {
            q: 'Aynı anda iki cihaz şarj edebilir miyim?',
            a: 'İki çıkışlı powerbanklarda evet. Bu durumda güç iki cihaz arasında paylaşılabilir ve şarj biraz yavaşlayabilir.',
        },
        {
            q: 'Powerbank için hangi kablo gerekir?',
            a: 'Powerbankın çıkışına ve telefonunuzun girişine uygun bir kablo. USB-A çıkışlı powerbanklarda USB-A to Lightning, USB-A to Type-C ya da Micro USB kablo kullanılır. 30 cm gibi kısa kablolar powerbankla birlikte taşımak için pratiktir.',
        },
    ],
    productsTitle: 'Powerbanklar ve kısa kablolar',
    products: {
        clauses: [
            { facets: ['powerbank'] },
            { facets: ['kablo'], q: 'mini', exclude: ['kulaklik', 'kablosuz', 'yazici'] },
        ],
    },
    productMatch: [{ facets: ['powerbank'] }],
}
