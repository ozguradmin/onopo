"use client"

import * as React from "react"
import { Phone, Mail, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react"

export function TopBar() {
    const [settings, setSettings] = React.useState({
        footer_phone: '0505 821 75 47',
        footer_email: 'onopostore@gmail.com',
        facebook_url: 'https://www.facebook.com/people/Onopostorecom/61572923320449/',
        instagram_url: 'https://www.instagram.com/onopostorecom/?igsh=aXgyYzMxbWlnaHJ0&utm_source=qr#',
        twitter_url: 'https://x.com/onopostore',
        youtube_url: 'https://www.youtube.com/@onopostore',
        linkedin_url: '',
    })

    React.useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(() => { })
    }, [])

    return (
        <div className="bg-slate-900 text-white text-xs py-2 hidden md:block">
            <div className="container mx-auto px-4 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    {settings.footer_phone && (
                        <a href={`tel:${settings.footer_phone.replace(/\s/g, '')}`} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                            <Phone className="w-3 h-3" />
                            <span>{settings.footer_phone}</span>
                        </a>
                    )}
                    {settings.footer_email && (
                        <a href={`mailto:${settings.footer_email}`} className="flex items-center gap-1 hover:text-slate-300 transition-colors">
                            <Mail className="w-3 h-3" />
                            <span>{settings.footer_email}</span>
                        </a>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    {settings.facebook_url && (
                        <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                            <Facebook className="w-3 h-3" />
                        </a>
                    )}
                    {settings.twitter_url && (
                        <a href={settings.twitter_url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                            <Twitter className="w-3 h-3" />
                        </a>
                    )}
                    {settings.instagram_url && (
                        <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                            <Instagram className="w-3 h-3" />
                        </a>
                    )}
                    {settings.youtube_url && (
                        <a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                            <Youtube className="w-3 h-3" />
                        </a>
                    )}
                    {settings.linkedin_url && (
                        <a href={settings.linkedin_url} target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition-colors">
                            <Linkedin className="w-3 h-3" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    )
}
