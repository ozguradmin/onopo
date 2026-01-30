'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function OrderErrorPage() {
    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-4 max-w-2xl text-center">
                <div className="bg-white rounded-2xl p-12 shadow-sm border border-slate-100">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-600" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-2">Ödeme Başarısız</h1>
                    <p className="text-slate-500 mb-6">
                        Ödeme işlemi sırasında bir hata oluştu. Lütfen tekrar deneyin.
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link href="/odeme">
                            <Button className="bg-slate-900 text-white hover:bg-slate-800">
                                Tekrar Dene
                            </Button>
                        </Link>
                        <Link href="/">
                            <Button variant="outline">Ana Sayfaya Dön</Button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    )
}
