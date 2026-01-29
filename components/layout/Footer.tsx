"use client"

import * as React from "react"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Linkedin } from "lucide-react"

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
    }, [])

    return (
        <footer className="bg-slate-950 text-slate-300 py-16 mt-20">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                    {/* Brand */}
                    <div className="space-y-4">
                        {settings.logo_url ? (
                            <img src={settings.logo_url} alt={settings.site_name} className="h-8 object-contain brightness-0 invert" />
                        ) : (
                            <h3 className="font-heading text-2xl font-bold text-white tracking-tighter">{settings.site_name}</h3>
                        )}
                        <p className="text-sm text-slate-400 max-w-xs">
                            {settings.site_description}
                        </p>
                        <div className="flex space-x-4 pt-2">
                            {settings.facebook_url && <SocialLink icon={<Facebook className="w-5 h-5" />} href={settings.facebook_url} />}
                            {settings.instagram_url && <SocialLink icon={<Instagram className="w-5 h-5" />} href={settings.instagram_url} />}
                            {settings.twitter_url && <SocialLink icon={<Twitter className="w-5 h-5" />} href={settings.twitter_url} />}
                            {settings.linkedin_url && <SocialLink icon={<Linkedin className="w-5 h-5" />} href={settings.linkedin_url} />}
                        </div>
                    </div>

                    {/* Shop - Dynamic Categories */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-6">Alışveriş</h4>
                        <ul className="space-y-3 text-sm">
                            <FooterLink href="/products">Tüm Ürünler</FooterLink>
                            {categories.map(cat => (
                                <FooterLink key={cat.id} href={`/${cat.slug}`}>{cat.name}</FooterLink>
                            ))}
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-6">Destek</h4>
                        <ul className="space-y-3 text-sm">
                            <FooterLink href="/page/help">Yardım Merkezi</FooterLink>
                            <FooterLink href="/page/shipping">Kargo &amp; İade</FooterLink>
                            <FooterLink href="/page/policy">Gizlilik Politikası</FooterLink>
                            <FooterLink href="/page/terms">Kullanım Koşulları</FooterLink>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-slate-900 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
                    <p>{settings.footer_text}</p>
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
