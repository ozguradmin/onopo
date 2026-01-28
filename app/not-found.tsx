import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="text-center max-w-md">
                <h1 className="text-9xl font-black text-slate-200">404</h1>
                <h2 className="text-2xl font-bold text-slate-900 mt-4">Sayfa Bulunamadı</h2>
                <p className="text-slate-500 mt-2 mb-8">
                    Aradığınız sayfa silinmiş veya taşınmış olabilir.
                </p>
                <Link href="/">
                    <Button className="rounded-full px-8 h-12 bg-slate-900 text-white hover:bg-slate-800">
                        Anasayfaya Dön
                    </Button>
                </Link>
            </div>
        </div>
    )
}
