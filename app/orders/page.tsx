'use client'

import * as React from 'react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { PackageOpen } from 'lucide-react'

export default function OrdersPage() {
    return (
        <>
            <Header />
            <main className="min-h-screen pt-24 pb-20 bg-slate-50">
                <div className="container mx-auto px-4 max-w-4xl">
                    <h1 className="text-2xl font-bold text-slate-900 mb-6">Siparişlerim</h1>

                    <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <PackageOpen className="w-8 h-8 text-slate-400" />
                        </div>
                        <h2 className="text-lg font-semibold text-slate-900 mb-2">Henüz siparişiniz yok</h2>
                        <p className="text-slate-500 mb-6">
                            Verdiğiniz siparişler burada listelenecektir.
                        </p>
                        <a href="/" className="inline-flex h-10 items-center justify-center rounded-md bg-slate-900 px-8 text-sm font-medium text-slate-50 hover:bg-slate-900/90 shadow-sm transition-colors">
                            Alışverişe Başla
                        </a>
                    </div>
                </div>
            </main>
            <Footer />
        </>
    )
}
