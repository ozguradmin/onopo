import type { Metadata } from 'next'
import { FrameAwareLink } from '@/components/checkout/FrameAwareLink'
import { Check, Mail, Package } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { privatePageMetadata } from '@/lib/seo'

// PayTR's merchant_ok_url (lib/payment/paytr.ts). It opens inside the PayTR iframe on /odeme/ (which
// polls the order and switches to its own success view) or on its own. Static content only: it
// must not depend on the order, the session or the cart.
export const metadata: Metadata = {
    title: 'Ödeme başarılı',
    ...privatePageMetadata,
}

export default function OrderSuccessPage() {
    return (
        <div className="min-h-[60vh] bg-surface py-8 lg:py-14">
            <div className="container-store">
                <div className="mx-auto max-w-xl rounded-sheet border border-line bg-white p-6 text-center shadow-card sm:p-10">
                    <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-50 text-success">
                        <Check className="h-8 w-8" strokeWidth={2.5} aria-hidden="true" />
                    </div>
                    <h1 className="type-h1 text-ink">Ödeme başarılı</h1>
                    <p className="mx-auto mt-3 max-w-md text-[15px] leading-6 text-muted">
                        Siparişin alındı ve en kısa sürede hazırlanıp kargoya verilecek. Teşekkür ederiz!
                    </p>

                    <ul className="mx-auto mt-6 max-w-sm space-y-2.5 text-left text-sm leading-5 text-ink-2">
                        <li className="flex items-start gap-3 rounded-card bg-surface px-3.5 py-3">
                            <Mail className="mt-px h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                            <span>
                                Sipariş detayları e-posta adresine gönderilecek. Gelmezse spam / gereksiz klasörüne bak.
                            </span>
                        </li>
                        <li className="flex items-start gap-3 rounded-card bg-surface px-3.5 py-3">
                            <Package className="mt-px h-[18px] w-[18px] shrink-0 text-brand-600" aria-hidden="true" />
                            <span>
                                Üye girişi yaptıysan siparişini{' '}
                                <FrameAwareLink href="/orders/" className="font-semibold text-brand-600 underline-offset-2 hover:underline">
                                    Siparişlerim
                                </FrameAwareLink>{' '}
                                sayfasından takip edebilirsin.
                            </span>
                        </li>
                    </ul>

                    <div className="mt-7 flex flex-col-reverse justify-center gap-3 sm:flex-row">
                        <FrameAwareLink href="/" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                            Ana sayfaya dön
                        </FrameAwareLink>
                        <FrameAwareLink href="/products/" className={buttonClasses({ variant: 'brand', size: '48' })}>
                            Alışverişe devam et
                        </FrameAwareLink>
                    </div>
                </div>
            </div>
        </div>
    )
}
