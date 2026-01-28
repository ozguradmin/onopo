import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"

export default function PolicyPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-white">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="text-4xl font-bold text-slate-900 mb-8">Gizlilik Politikası</h1>

                    <div className="space-y-6 text-slate-600">
                        <p className="text-sm text-slate-400">Son güncelleme: Ocak 2026</p>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Toplanan Bilgiler</h2>
                            <p>Hizmetlerimizi kullanırken sizden isim, e-posta adresi, teslimat adresi ve ödeme bilgileri gibi kişisel bilgiler toplayabiliriz. Bu bilgiler siparişlerinizi işlemek ve size daha iyi hizmet sunmak için kullanılmaktadır.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Bilgilerin Kullanımı</h2>
                            <p>Topladığımız bilgileri aşağıdaki amaçlarla kullanmaktayız:</p>
                            <ul className="list-disc list-inside mt-2 space-y-1">
                                <li>Siparişlerinizi işlemek ve teslim etmek</li>
                                <li>Müşteri hizmetleri sağlamak</li>
                                <li>Kampanya ve özel teklifler hakkında bilgilendirmek</li>
                                <li>Web sitemizi geliştirmek</li>
                            </ul>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Bilgi Güvenliği</h2>
                            <p>Kişisel bilgileriniz 256-bit SSL şifreleme ile korunmaktadır. Ödeme bilgileriniz güvenli ödeme altyapımız tarafından işlenmekte ve sunucularımızda saklanmamaktadır.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Çerezler</h2>
                            <p>Web sitemiz, kullanıcı deneyimini iyileştirmek için çerezler kullanmaktadır. Tarayıcı ayarlarınızdan çerezleri devre dışı bırakabilirsiniz; ancak bu durumda bazı özellikler düzgün çalışmayabilir.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. İletişim</h2>
                            <p>Gizlilik politikamız hakkında sorularınız için destek@onopo.com adresinden bize ulaşabilirsiniz.</p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
            <MobileNav />
        </>
    )
}
