"use client"

import * as React from "react"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Linkedin, DollarSign } from "lucide-react"
import { getImageUrl } from "@/lib/utils"

interface Category {
    id: number
    name: string
    slug: string
    product_count?: number
}

export function Footer() {
    const [settings, setSettings] = React.useState({
        site_name: 'ONOPO',
        site_description: 'Yaşam tarzı ve teknolojinin geleceğini tanımlıyoruz. Modern yaratıcılar için premium temeller.',
        logo_url: '',
        footer_text: '© 2026 Onopo Store. Tüm hakları saklıdır.',
        footer_email: '',
        footer_phone: '',
        footer_address: '',
        facebook_url: '',
        instagram_url: '',
        twitter_url: '',
        linkedin_url: ''
    })
    const [categories, setCategories] = React.useState<Category[]>([])
    const [exchangeRate, setExchangeRate] = React.useState<number | null>(null)

    React.useEffect(() => {
        // Track page view
        fetch('/api/analytics/track', {
            method: 'POST',
            body: JSON.stringify({ page: window.location.pathname })
        }).catch(() => { })

        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(() => { })

        // Fetch categories with products, filtered by admin-selected footer_categories
        Promise.all([
            fetch('/api/categories').then(r => r.json()),
            fetch('/api/site-settings').then(r => r.json())
        ]).then(([categoriesData, settingsData]) => {
            let footerCats: string[] = []
            try {
                footerCats = settingsData.footer_categories ? JSON.parse(settingsData.footer_categories) : []
            } catch { }

            // If admin selected specific categories, use those
            // Otherwise show top 4 categories with products
            const allCats = categoriesData || []
            let catsToShow: Category[]

            if (footerCats.length > 0) {
                catsToShow = allCats.filter((c: Category) => footerCats.includes(c.name))
            } else {
                catsToShow = allCats
                    .filter((c: Category) => c.product_count && c.product_count > 0)
                    .slice(0, 4)
            }
            setCategories(catsToShow)
        }).catch(() => { })

        // Fetch exchange rate
        fetch('/api/exchange-rate')
            .then(r => r.json())
            .then(data => {
                if (data.rate) setExchangeRate(data.rate)
            })
            .catch(() => { })
    }, [])

    return (
        <footer className="bg-slate-950 text-slate-300 py-10 mt-12">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
                    {/* Brand */}
                    <div className="col-span-2 md:col-span-1 space-y-3">
                        {settings.logo_url ? (
                            <img src={getImageUrl(settings.logo_url)} alt={settings.site_name} className="h-7 object-contain brightness-0 invert" />
                        ) : (
                            <h3 className="font-heading text-xl font-bold text-white tracking-tighter">{settings.site_name}</h3>
                        )}
                        <p className="text-sm text-slate-400 max-w-xs leading-relaxed">
                            {settings.site_description}
                        </p>
                        <div className="flex gap-3 pt-1">
                            {settings.facebook_url && <SocialLink icon={<Facebook className="w-4 h-4" />} href={settings.facebook_url} />}
                            {settings.instagram_url && <SocialLink icon={<Instagram className="w-4 h-4" />} href={settings.instagram_url} />}
                            {settings.twitter_url && <SocialLink icon={<Twitter className="w-4 h-4" />} href={settings.twitter_url} />}
                            {settings.linkedin_url && <SocialLink icon={<Linkedin className="w-4 h-4" />} href={settings.linkedin_url} />}
                        </div>
                    </div>

                    {/* Shop - Dynamic Categories */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-4 text-sm">Alışveriş</h4>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/products">Tüm Ürünler</FooterLink>
                            {categories.map(cat => (
                                <FooterLink key={cat.id} href={`/products?category=${encodeURIComponent(cat.name)}`}>{cat.name}</FooterLink>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-4 text-sm">Destek</h4>
                        <ul className="space-y-2 text-sm">
                            <FooterLink href="/page/help">Yardım Merkezi</FooterLink>
                            <FooterLink href="/page/shipping">Kargo & İade</FooterLink>
                            <FooterLink href="/page/policy">Gizlilik Politikası</FooterLink>
                            <FooterLink href="/page/terms">Kullanım Koşulları</FooterLink>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-4 text-sm">İletişim</h4>
                        <ul className="space-y-2 text-sm">
                            {settings.footer_email && (
                                <li><a href={`mailto:${settings.footer_email}`} className="hover:text-white transition-colors">{settings.footer_email}</a></li>
                            )}
                            {settings.footer_phone && (
                                <li><a href={`tel:${settings.footer_phone}`} className="hover:text-white transition-colors">{settings.footer_phone}</a></li>
                            )}
                            {settings.footer_address && (
                                <li className="text-slate-400">{settings.footer_address}</li>
                            )}
                            {!settings.footer_email && !settings.footer_phone && !settings.footer_address && (
                                <li className="text-slate-500">info@onopo.com</li>
                            )}
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-800 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-2">
                    <p>{settings.footer_text}</p>
                    <div className="flex items-center gap-4">
                        {exchangeRate && (
                            <span className="flex items-center gap-1 text-green-400">
                                <DollarSign className="w-3 h-3" />
                                1 USD = {exchangeRate.toFixed(2)} ₺
                            </span>
                        )}
                        <p>Güvenli Ödeme & Hızlı Teslimat</p>
                    </div>
                </div>
            </div>
        </footer>
    )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
    return (
        <li>
            <Link href={href} className="hover:text-white transition-colors">
                {children}
            </Link>
        </li>
    )
}

function SocialLink({ icon, href }: { icon: React.ReactNode; href: string }) {
    return (
        <a
            href={href}
            className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center hover:bg-primary hover:text-white transition-all text-slate-400"
        >
            {icon}
        </a>
    )
}
