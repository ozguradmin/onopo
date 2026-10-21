"use client"

import * as React from "react"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Linkedin, Youtube } from "lucide-react"
import { getImageUrl } from "@/lib/utils"
import { useCategories, useShellChrome, useSiteSettings } from "@/components/layout/store-data"

/**
 * Store footer. Rendered once by the root shell (`fromShell`); legacy pages that render <Footer />
 * themselves get nothing. Settings and categories come from the server (store-data context).
 * Page-view tracking moved to LayoutProvider; the USD/TRY rate is no longer shown to customers
 * (the exchange-rate cron is unaffected).
 */
export function Footer({ fromShell = false }: { fromShell?: boolean }) {
    const shellChrome = useShellChrome()
    if (shellChrome && !fromShell) return null
    return <FooterInner />
}

function FooterInner() {
    const s = useSiteSettings()
    const allCategories = useCategories()

    const settings = {
        site_name: s.site_name || 'ONOPO',
        site_description: s.site_description || 'Yaşam tarzı ve teknolojinin geleceğini tanımlıyoruz. Modern yaratıcılar için premium temeller.',
        logo_url: s.logo_url || '',
        footer_text: s.footer_text || `© ${new Date().getFullYear()} Onopo Store. Tüm hakları saklıdır.`,
    }

    // Admin-selected footer categories, otherwise the first 4 categories with products
    const categories = s.footer_categories.length > 0
        ? allCategories.filter(c => s.footer_categories.includes(c.name))
        : allCategories.filter(c => c.product_count > 0).slice(0, 4)

    return (
        <footer className="bg-slate-950 text-slate-300 py-10 mt-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1 space-y-3">
                        {settings.logo_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={getImageUrl(settings.logo_url)} alt={settings.site_name} width={140} height={28} loading="lazy" className="h-7 w-auto object-contain brightness-0 invert" />
                        ) : (
                            <p className="font-heading text-xl font-bold text-white tracking-tighter">{settings.site_name}</p>
                        )}
                        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                            {settings.site_description}
                        </p>
                        {s.footer_social_visible && (
                            <div className="flex gap-3 pt-1">
                                {s.facebook_url && <SocialLink label="Facebook" icon={<Facebook className="w-4 h-4" />} href={s.facebook_url} />}
                                {s.instagram_url && <SocialLink label="Instagram" icon={<Instagram className="w-4 h-4" />} href={s.instagram_url} />}
                                {s.twitter_url && <SocialLink label="X (Twitter)" icon={<Twitter className="w-4 h-4" />} href={s.twitter_url} />}
                                {s.youtube_url && <SocialLink label="YouTube" icon={<Youtube className="w-4 h-4" />} href={s.youtube_url} />}
                                {s.linkedin_url && <SocialLink label="LinkedIn" icon={<Linkedin className="w-4 h-4" />} href={s.linkedin_url} />}
                            </div>
                        )}
                    </div>

                    {/* Shop - Dynamic Categories */}
                    <div>
                        <h2 className="font-heading text-white font-semibold mb-4 text-sm">Alışveriş</h2>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/products/">Tüm Ürünler</FooterLink>
                            {categories.map(cat => (
                                <FooterLink key={cat.id} href={cat.href}>{cat.name}</FooterLink>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h2 className="font-heading text-white font-semibold mb-4 text-sm">Destek</h2>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/page/help">Yardım Merkezi</FooterLink>
                            <FooterLink href="/page/shipping">Kargo & İade</FooterLink>
                            <FooterLink href="/page/policy">Gizlilik Politikası</FooterLink>
                            <FooterLink href="/page/terms">Kullanım Koşulları</FooterLink>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h2 className="font-heading text-white font-semibold mb-4 text-sm">İletişim</h2>
                        <ul className="space-y-2 text-sm">
                            {s.footer_email && (
                                <li><a href={`mailto:${s.footer_email}`} className="hover:text-white transition-colors">{s.footer_email}</a></li>
                            )}
                            {s.footer_phone && (
                                <li><a href={`tel:${s.footer_phone.replace(/\s/g, '')}`} className="hover:text-white transition-colors">{s.footer_phone}</a></li>
                            )}
                            {s.footer_address && (
                                <li className="text-slate-400">{s.footer_address}</li>
                            )}
                            {!s.footer_email && !s.footer_phone && !s.footer_address && (
                                <li className="text-slate-500">info@onopo.com</li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-2">
                    <p>{settings.footer_text}</p>
                    <p>Güvenli Ödeme & Hızlı Teslimat</p>
                </div>
            </div>
        </footer>
    )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <li>
            <Link href={href} prefetch={false} className="hover:text-white transition-colors">
                {children}
            </Link>
        </li>
    )
}

function SocialLink({ icon, href, label }: { icon: React.ReactNode; href: string; label: string }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={label}
            className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400"
        >
            {icon}
        </a>
    )
}
