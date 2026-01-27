import type { Metadata } from 'next'
import { Header } from '@/components/layout/Header'

export const metadata: Metadata = {
    title: 'Admin Dashboard - Onopo',
    description: 'Manage products and orders',
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="min-h-screen bg-slate-50">
            <header className="bg-slate-900 text-white p-4">
                <div className="container mx-auto flex justify-between items-center">
                    <h1 className="text-xl font-bold">Onopo Admin</h1>
                    <nav className="flex gap-4">
                        <a href="/admin" className="hover:text-slate-300">Dashboard</a>
                        <a href="/admin/products/new" className="hover:text-slate-300">Yeni Ürün</a>
                        <a href="/" className="hover:text-slate-300">Mağazaya Dön</a>
                    </nav>
                </div>
            </header>
            <main className="container mx-auto py-8 px-4">
                {children}
            </main>
        </div>
    )
}
