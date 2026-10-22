import type { Metadata } from 'next'
import { CreditCard, Mail, MessageCircle, ShoppingBag, XCircle } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { privatePageMetadata } from '@/lib/seo'
import { getSiteSettings } from '@/lib/catalog'

// PayTR's merchant_fail_url (lib/payment/paytr.ts). It opens inside the PayTR iframe on /odeme/ or on
// its own. The cart is NOT touched here (it is only cleared after a confirmed payment), so
// "Tekrar dene" goes back to /odeme/ with the same cart. Links leave the iframe: target="_top" (plain
// <a>: works before hydration; on its own, _top is the same window), WhatsApp opens a new tab.
export const metadata: Metadata = {
    title: 'Ödeme tamamlanamadı',
    ...privatePageMetadata,
}

function whatsappHref(number: string): string | null {
    const digits = number.replace(/\D/g, '')
    if (digits.length < 10) return null
    const intl = digits.startsWith('90') ? digits : digits.startsWith('0') ? `9${digits}` : `90${digits}`
    return `https://wa.me/${intl}`
}

export default async function OrderErrorPage() {
    const settings = await getSiteSettings()
    const whatsapp = settings.whatsapp_number ? whatsappHref(settings.whatsapp_number) : null

    return (
        <div className="min-h-[60vh] bg-surface py-8 lg:py-14">
            <div className="container-store">
                <div className="mx-auto max-w-xl rounded-sheet border border-line bg-white p-6 text-center shadow-card sm:p-10">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sale-50 text-sale">
                        <XCircle className="h-8 w-8" aria-hidden="true" />
                    </div>
                    <h1 className="type-h1 text-ink">Ödeme tamamlanamadı</h1>
                    <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted">
                        Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar dene.
                    </p>

                    <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left text-sm leading-5 text-ink-2">
                        <li className="flex items-start gap-3 rounded-card bg-surface px-3.5 py-3">
                            <ShoppingBag className="mt-px h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                            <span>Sepetindeki ürünler duruyor; tekrar denediğinde bilgilerini yeniden girmen yeterli.</span>
                        </li>
                        <li className="flex items-start gap-3 rounded-card bg-surface px-3.5 py-3">
                            <CreditCard className="mt-px h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                            <span>Kart limitini, 3D Secure (SMS) şifresini ve kartının internet alışverişine açık olduğunu kontrol et ya da başka bir kart dene.</span>
                        </li>
                    </ul>

                    <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                        <a href="/" target="_top" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                            Ana sayfaya dön
                        </a>
                        <a href="/odeme/" target="_top" className={buttonClasses({ variant: 'brand', size: '48' })}>
                            Tekrar dene
                        </a>
                    </div>

                    {(settings.footer_email || whatsapp) && (
                        <div className="mt-7 border-t border-line pt-5 text-sm text-muted">
                            <p>Sorun devam ederse bize yaz, hemen yardımcı olalım:</p>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                {whatsapp && (
                                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'whatsapp', size: '44' })}>
                                        <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
                                    </a>
                                )}
                                {settings.footer_email && (
                                    <a href={`mailto:${settings.footer_email}`} target="_top" className={buttonClasses({ variant: 'subtle', size: '44' })}>
                                        <Mail className="h-4 w-4" aria-hidden="true" /> {settings.footer_email}
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
