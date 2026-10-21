import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Mail, MessageCircle, Wrench } from 'lucide-react'
import { getSiteSettings } from '@/lib/catalog'
import { privatePageMetadata } from '@/lib/seo'
import { originalImageUrl } from '@/lib/images'
import { buttonClasses } from '@/components/ui/button'

// /maintenance/: shown without the store header/footer (LayoutProvider). The maintenance switch is
// site_settings.maintenance_mode, read on the server: when it is off this URL sends visitors home.
// The data-onopo-nocache marker keeps this response out of the edge cache.
export const metadata: Metadata = {
    title: 'Bakımdayız',
    ...privatePageMetadata,
}

function whatsappHref(number: string): string | null {
    const digits = number.replace(/\D/g, '')
    if (digits.length < 10) return null
    const intl = digits.startsWith('90') ? digits : digits.startsWith('0') ? `9${digits}` : `90${digits}`
    return `https://wa.me/${intl}`
}

export default async function MaintenancePage() {
    const settings = await getSiteSettings()
    if (!settings.maintenance_mode) redirect('/')

    const whatsapp = settings.whatsapp_number ? whatsappHref(settings.whatsapp_number) : null
    const logo = settings.logo_url ? originalImageUrl(settings.logo_url) : null

    return (
        <div className="relative flex min-h-screen flex-col bg-surface">
            <div hidden data-onopo-nocache="" />
            <header className="flex justify-center px-4 pt-8 lg:pt-12">
                {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={settings.site_name} width={160} height={32} className="h-8 w-auto" />
                ) : (
                    <span className="text-xl font-extrabold tracking-tight text-ink">{settings.site_name}</span>
                )}
            </header>
            <div className="flex flex-1 items-center justify-center px-4 py-10">
                <div className="w-full max-w-lg rounded-sheet border border-line bg-white p-6 text-center shadow-raised sm:p-10">
                    <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                        <Wrench className="h-8 w-8" />
                    </span>
                    <h1 className="type-h1 mt-5 text-ink">Kısa bir bakımdayız</h1>
                    <p className="mt-3 text-[15px] leading-6 text-muted">
                        Sitemizi senin için güncelliyoruz. Çok kısa süre içinde tekrar buradayız; anlayışın için teşekkür ederiz.
                    </p>
                    {(whatsapp || settings.footer_email) && (
                        <div className="mt-7 border-t border-line pt-6">
                            <p className="text-sm text-muted">Siparişinle ilgili bir sorun mu var? Bize ulaş:</p>
                            <div className="mt-3 flex flex-col justify-center gap-2 sm:flex-row">
                                {whatsapp && (
                                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'whatsapp', size: '44' })}>
                                        <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> WhatsApp
                                    </a>
                                )}
                                {settings.footer_email && (
                                    <a href={`mailto:${settings.footer_email}`} className={buttonClasses({ variant: 'subtle', size: '44' })}>
                                        <Mail className="h-[18px] w-[18px]" aria-hidden="true" /> {settings.footer_email}
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <footer className="pb-8 text-center text-[13px] text-muted">
                © {new Date().getFullYear()} {settings.site_name}
            </footer>
        </div>
    )
}
