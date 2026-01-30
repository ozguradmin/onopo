'use client'

import * as React from 'react'
import { Wrench, Clock, Mail } from 'lucide-react'

export default function MaintenancePage() {
    const [settings, setSettings] = React.useState({
        site_name: 'ONOPO',
        footer_email: 'info@onopo.com'
    })

    React.useEffect(() => {
        fetch('/api/site-settings')
            .then(r => r.json())
            .then(data => setSettings(prev => ({ ...prev, ...data })))
            .catch(() => { })
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="max-w-lg w-full text-center">
                {/* Animated Icon */}
                <div className="relative mb-8">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-yellow-400 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-orange-500/30 animate-pulse">
                        <Wrench className="w-12 h-12 text-white" />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-2 bg-black/20 rounded-full blur-sm"></div>
                </div>

                {/* Title */}
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-heading tracking-tight">
                    Bakımdayız
                </h1>

                {/* Description */}
                <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                    Şu anda sitemizi sizin için daha iyi hale getirmek adına bakım çalışması yapıyoruz.
                    Kısa süre içinde tekrar hizmetinizde olacağız.
                </p>

                {/* Info Cards */}
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                        <Clock className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">Tahmini Süre</p>
                        <p className="text-white font-semibold">Kısa Sürede</p>
                    </div>
                    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4">
                        <Mail className="w-6 h-6 text-blue-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-400">İletişim</p>
                        <a href={`mailto:${settings.footer_email}`} className="text-white font-semibold hover:text-blue-400 transition-colors">
                            {settings.footer_email}
                        </a>
                    </div>
                </div>

                {/* Brand */}
                <div className="text-slate-500 text-sm">
                    <p>{settings.site_name} &copy; {new Date().getFullYear()}</p>
                </div>
            </div>
        </div>
    )
}
