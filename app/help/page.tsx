import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"

export default function HelpPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-white">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="text-4xl font-bold text-slate-900 mb-8">Yardım Merkezi</h1>

                    <div className="space-y-8">
                        <section>
                            <h2 className="text-2xl font-semibold text-slate-800 mb-4">Sıkça Sorulan Sorular</h2>

                            <div className="space-y-4">
                                <div className="p-6 bg-slate-50 rounded-2xl">
                                    <h3 className="font-semibold text-slate-900 mb-2">Siparişimi nasıl takip edebilirim?</h3>
                                    <p className="text-slate-600">Sipariş onay e-postanızda yer alan takip numarasıyla kargo firmasının web sitesinden siparişinizi takip edebilirsiniz.</p>
                                </div>

                                <div className="p-6 bg-slate-50 rounded-2xl">
                                    <h3 className="font-semibold text-slate-900 mb-2">İade süreci nasıl işliyor?</h3>
                                    <p className="text-slate-600">Ürününüzü teslim aldıktan sonra 14 gün içinde iade talebinde bulunabilirsiniz. Ürünün kullanılmamış ve orijinal ambalajında olması gerekmektedir.</p>
                                </div>

                                <div className="p-6 bg-slate-50 rounded-2xl">
                                    <h3 className="font-semibold text-slate-900 mb-2">Ödeme seçenekleri nelerdir?</h3>
                                    <p className="text-slate-600">Kredi kartı, banka kartı ve havale/EFT ile ödeme yapabilirsiniz. Tüm ödemeleriniz 256-bit SSL ile şifrelenmektedir.</p>
                                </div>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-slate-800 mb-4">İletişim</h2>
                            <div className="p-6 bg-slate-900 text-white rounded-2xl">
                                <p className="mb-2"><strong>Email:</strong> destek@onopo.com</p>
                                <p className="mb-2"><strong>Telefon:</strong> 0850 123 45 67</p>
                                <p><strong>Çalışma Saatleri:</strong> Hafta içi 09:00 - 18:00</p>
                            </div>
                        </section>
                    </div>
                </div>
            </main>
            <Footer />
            <MobileNav />
        </>
    )
}
