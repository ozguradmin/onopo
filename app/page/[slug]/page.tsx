import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { ChevronRight, Mail, MessageCircle, Phone } from 'lucide-react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { CmsContent } from '@/components/cms/CmsContent'
import { buttonClasses } from '@/components/ui/button'
import { getCmsPageLinks } from '@/lib/cms-pages'
import { getSiteSettings } from '@/lib/catalog'
import { formatDateTR } from '@/lib/format'
import { buildMetadata, cmsPageDescription } from '@/lib/seo'
import { getSiteSeo } from '@/lib/seo-server'
import { normalizeSlugParam, resolveCmsPageCached } from '@/lib/seo-routing'
import { cn } from '@/lib/utils'

// CMS pages (Admin › Sayfalar) at their canonical URL /page/<slug>/. Server-rendered; an unknown slug is
// a real 404, another spelling of a lowercase slug (/page/Help/) a 308 to it, like root and /kategori/ slugs.
// No loading.tsx / Suspense around this page: the status code must be decided first.
type Params = Promise<{ slug: string }>

/** The canonical path when `slug` only differs in case from an existing lowercase page slug, else null. */
async function otherCasePath(slug: string): Promise<string | null> {
    const lower = normalizeSlugParam(slug)?.toLowerCase()
    if (!lower || lower === normalizeSlugParam(slug)) return null
    return (await resolveCmsPageCached(lower))?.path ?? null
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
    const page = await resolveCmsPageCached((await params).slug)
    // Unknown slug: the page calls notFound(); keep the 404 title instead of the site default
    if (!page) return { title: 'Sayfa bulunamadı', robots: { index: false, follow: true } }
    const site = await getSiteSeo()
    return buildMetadata({
        title: page.title,
        description: cmsPageDescription(page.title, page.content),
        path: page.path,
        type: 'article',
        site,
    })
}

function whatsappHref(number: string): string | null {
    const digits = number.replace(/\D/g, '')
    if (digits.length < 10) return null
    const intl = digits.startsWith('90') ? digits : digits.startsWith('0') ? `9${digits}` : `90${digits}`
    return `https://wa.me/${intl}`
}

function telHref(phone: string): string {
    const digits = phone.replace(/\D/g, '')
    const national = digits.startsWith('90') ? digits.slice(2) : digits.replace(/^0/, '')
    return `tel:+90${national}`
}

export default async function CmsPage({ params }: { params: Params }) {
    const { slug } = await params
    const page = await resolveCmsPageCached(slug)
    if (!page) {
        const canonical = await otherCasePath(slug)
        if (canonical) permanentRedirect(canonical)
        notFound()
    }

    const [links, settings] = await Promise.all([getCmsPageLinks(), getSiteSettings()])
    const updated = formatDateTR(page.updatedAt)
    const whatsapp = settings.whatsapp_number ? whatsappHref(settings.whatsapp_number) : null
    const hasContact = !!(settings.footer_email || settings.footer_phone || whatsapp)

    return (
        <div className="bg-canvas pb-14 pt-4 lg:pb-20 lg:pt-6">
            <div className="container-store">
                <Breadcrumb jsonLd items={[{ label: 'Anasayfa', href: '/' }, { label: page.title }]} />

                <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-12 lg:gap-12">
                    <article className="min-w-0 lg:col-span-8">
                        <header className="border-b border-line pb-5 lg:pb-6">
                            <h1 className="type-h1 text-ink">{page.title}</h1>
                            {updated && (
                                <p className="mt-2 text-[13px] text-muted">
                                    Son güncelleme: <time dateTime={page.updatedAt?.replace(' ', 'T') ?? undefined}>{updated}</time>
                                </p>
                            )}
                        </header>
                        <div className="mt-6 max-w-[68ch] lg:mt-8">
                            {page.content.trim() ? (
                                <CmsContent content={page.content} title={page.title} />
                            ) : (
                                <p className="text-muted">Bu sayfanın içeriği hazırlanıyor.</p>
                            )}
                        </div>
                    </article>

                    <aside className="mt-10 space-y-4 lg:col-span-4 lg:mt-0">
                        <div className="lg:sticky lg:top-[88px] lg:space-y-4">
                            {links.length > 1 && (
                                <nav aria-label="Müşteri hizmetleri" className="rounded-sheet border border-line bg-surface p-2">
                                    <p className="type-micro px-3 pb-1 pt-2 text-muted">Müşteri hizmetleri</p>
                                    <ul>
                                        {links.map(link => {
                                            const current = link.slug === page.slug
                                            return (
                                                <li key={link.slug}>
                                                    <Link
                                                        href={link.href}
                                                        aria-current={current ? 'page' : undefined}
                                                        className={cn(
                                                            'flex min-h-11 items-center justify-between gap-3 rounded-card px-3 text-sm font-medium transition-colors',
                                                            current ? 'bg-white text-brand-700 shadow-card' : 'text-ink-2 hover:bg-white hover:text-ink',
                                                        )}
                                                    >
                                                        {link.title}
                                                        <ChevronRight className={cn('h-4 w-4 shrink-0', current ? 'text-brand-600' : 'text-subtle')} aria-hidden="true" />
                                                    </Link>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </nav>
                            )}

                            {hasContact && (
                                <section aria-labelledby="cms-contact-title" className="mt-4 rounded-sheet border border-line bg-white p-5 lg:mt-0">
                                    <h2 id="cms-contact-title" className="type-h3 text-ink">
                                        Yardıma mı ihtiyacın var?
                                    </h2>
                                    <p className="mt-1 text-[13px] leading-5 text-muted">Sorularını yanıtlamaktan memnuniyet duyarız.</p>
                                    <div className="mt-4 flex flex-col gap-2">
                                        {whatsapp && (
                                            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'whatsapp', size: '44', fullWidth: true })}>
                                                <MessageCircle className="h-[18px] w-[18px]" aria-hidden="true" /> WhatsApp ile yaz
                                            </a>
                                        )}
                                        {settings.footer_phone && (
                                            <a href={telHref(settings.footer_phone)} className={buttonClasses({ variant: 'subtle', size: '44', fullWidth: true, className: 'justify-start' })}>
                                                <Phone className="h-[18px] w-[18px]" aria-hidden="true" /> {settings.footer_phone}
                                            </a>
                                        )}
                                        {settings.footer_email && (
                                            <a href={`mailto:${settings.footer_email}`} className={buttonClasses({ variant: 'subtle', size: '44', fullWidth: true, className: 'justify-start' })}>
                                                <Mail className="h-[18px] w-[18px]" aria-hidden="true" />
                                                <span className="truncate">{settings.footer_email}</span>
                                            </a>
                                        )}
                                    </div>
                                </section>
                            )}
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    )
}
