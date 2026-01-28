import { Header } from "@/components/layout/Header"
import { Footer } from "@/components/layout/Footer"
import { MobileNav } from "@/components/layout/MobileNav"

export default function ShippingPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-white">
                <div className="container mx-auto px-4 max-w-3xl">
                    <h1 className="text-4xl font-bold text-slate-900 mb-8">Kargo & İade</h1>

                    <div className="space-y-8 prose prose-slate max-w-none">
                        <section>
                            <h2 className="text-2xl font-semibold text-slate-800 mb-4">Kargo Bilgileri</h2>
                            <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                                <p className="text-slate-600">• Siparişleriniz 1-3 iş günü içinde kargoya teslim edilir.</p>
                                <p className="text-slate-600">• 150₺ ve üzeri siparişlerde kargo ücretsizdir.</p>
                                <p className="text-slate-600">• 150₺ altı siparişlerde kargo ücreti 29.90₺'dir.</p>
                                <p className="text-slate-600">• Kargo teslimat süresi ortalama 2-5 iş günüdür.</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-slate-800 mb-4">İade Politikası</h2>
                            <div className="p-6 bg-slate-50 rounded-2xl space-y-4">
                                <p className="text-slate-600">• Ürünü teslim aldıktan sonra 14 gün içinde iade edebilirsiniz.</p>
                                <p className="text-slate-600">• İade edilecek ürün kullanılmamış ve orijinal ambalajında olmalıdır.</p>
                                <p className="text-slate-600">• İade kargo ücreti müşteriye aittir (hatalı/hasarlı ürün hariç).</p>
                                <p className="text-slate-600">• İade onaylandıktan sonra ödemeniz 5-10 iş günü içinde iade edilir.</p>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-2xl font-semibold text-slate-800 mb-4">İade Nasıl Yapılır?</h2>
                            <div className="p-6 bg-slate-900 text-white rounded-2xl">
                                <ol className="list-decimal list-inside space-y-2">
                                    <li>destek@onopo.com adresine iade talebinizi gönderin</li>
                                    <li>Size iletilen kargo kodunu alın</li>
                                    <li>Ürünü orijinal ambalajında kargoya verin</li>
                                    <li>Kargo takip numarasını bize iletin</li>
                                </ol>
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
