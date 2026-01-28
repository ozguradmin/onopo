import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"

export default function TermsPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-white">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="text-4xl font-bold text-slate-900 mb-8">Kullanım Koşulları</h1>

                    <div className="space-y-6 text-slate-600">
                        <p className="text-sm text-slate-400">Son güncelleme: Ocak 2026</p>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">1. Genel Koşullar</h2>
                            <p>Bu web sitesini kullanarak aşağıdaki kullanım koşullarını kabul etmiş sayılırsınız. Bu koşulları kabul etmiyorsanız, lütfen sitemizi kullanmayın.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">2. Hesap Sorumluluğu</h2>
                            <p>Hesabınızın güvenliğinden siz sorumlusunuz. Şifrenizi kimseyle paylaşmamalı ve hesabınızda şüpheli bir aktivite fark ettiğinizde derhal bize bildirmelisiniz.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">3. Ürünler ve Fiyatlandırma</h2>
                            <p>Sitemizdeki ürün bilgileri ve fiyatlar önceden haber vermeksizin değiştirilebilir. Fiyat hataları durumunda siparişinizi iptal etme hakkımız saklıdır.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">4. Fikri Mülkiyet</h2>
                            <p>Bu sitedeki tüm içerik, tasarım, logolar ve görseller ONOPO'ya aittir ve izinsiz kullanılamaz.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">5. Sorumluluk Reddi</h2>
                            <p>Sitemizi "olduğu gibi" sunmaktayız. Teknik aksaklıklar veya kesintiler nedeniyle oluşabilecek zararlardan sorumlu tutulamayız.</p>
                        </section>

                        <section>
                            <h2 className="text-xl font-semibold text-slate-800 mb-3">6. İletişim</h2>
                            <p>Kullanım koşullarımız hakkında sorularınız için destek@onopo.com adresinden bize ulaşabilirsiniz.</p>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
            <MobileNav />
        </>
    )
}
