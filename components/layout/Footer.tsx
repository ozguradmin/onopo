"use client"

import * as React from "react"
import Link from "next/link"
import { Facebook, Instagram, Twitter, Linkedin, Heart } from "lucide-react"

export function Footer() {
    const [settings, setSettings] = React.useState({
        site_name: 'ONOPO',
        site_description: 'Yaşam tarzı ve teknolojinin geleceğini tanımlıyoruz. Modern yaratıcılar için premium temeller.',
        logo_url: '',
        footer_text: '© 2026 Onopo Store. Tüm hakları saklıdır.',
        footer_email: '',
        footer_phone: '',
        footer_address: ''
    })

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
    }, [])

    return (
        <footer className="bg-slate-950 text-slate-300 py-16 mt-20">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
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
                            <SocialLink icon={<Facebook className="w-5 h-5" />} href="#" />
                            <SocialLink icon={<Instagram className="w-5 h-5" />} href="#" />
                            <SocialLink icon={<Twitter className="w-5 h-5" />} href="#" />
                            <SocialLink icon={<Linkedin className="w-5 h-5" />} href="#" />
                        </div>
                    </div>

                    {/* Shop */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-6">Alışveriş</h4>
                        <ul className="space-y-3 text-sm">
                            <FooterLink href="/tech">Teknoloji</FooterLink>
                            <FooterLink href="/beauty">Kozmetik</FooterLink>
                            <FooterLink href="/gaming">Oyun</FooterLink>
                            <FooterLink href="/new">Yeni Gelenler</FooterLink>
                        </ul>
                    </div>

                    {/* Support */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-6">Destek</h4>
                        <ul className="space-y-3 text-sm">
                            <FooterLink href="/page/help">Yardım Merkezi</FooterLink>
                            <FooterLink href="/page/shipping">Kargo & İade</FooterLink>
                            <FooterLink href="/page/policy">Gizlilik Politikası</FooterLink>
                            <FooterLink href="/page/terms">Kullanım Koşulları</FooterLink>
                        </ul>
                    </div>

                    {/* Newsletter */}
                    <div>
                        <h4 className="font-heading text-white font-semibold mb-6">Bağlantıda Kal</h4>
                        <p className="text-sm text-slate-400 mb-4">
                            Özel teklifler ve yeni ürünlerden haberdar olmak için abone olun.
                        </p>
                        <div className="flex flex-col space-y-2">
                            <input
                                type="email"
                                placeholder="E-posta adresiniz"
                                className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <button className="bg-primary text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-primary/90 transition-colors">
                                Abone Ol
                            </button>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-900 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500">
                    <p>{settings.footer_text}</p>
                    <div className="flex space-x-4 mt-4 md:mt-0">
                        <Link href="/privacy" className="hover:text-slate-300 transition-colors">Gizlilik</Link>
                        <Link href="/terms" className="hover:text-slate-300 transition-colors">Kullanım Şartları</Link>
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
