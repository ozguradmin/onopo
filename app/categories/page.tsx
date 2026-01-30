'use client'

import * as React from 'react'
import Link from 'next/link'
import {
    Laptop, Sparkles, Gamepad2, Package, Zap, Heart,
    Shirt, Home, Camera, Headphones, Watch, Gift,
    ShoppingBag, Star, Tv, Phone, Tablet, Monitor,
    Printer, Speaker, Keyboard, Mouse, Coffee, Book,
    Bike, Car, Plane, Music, Film, Palette, ChevronRight
} from 'lucide-react'

// Icon mapping for categories
const iconMap: Record<string, any> = {
    laptop: Laptop,
    sparkles: Sparkles,
    gamepad: Gamepad2,
    package: Package,
    zap: Zap,
    heart: Heart,
    shirt: Shirt,
    home: Home,
    camera: Camera,
    headphones: Headphones,
    watch: Watch,
    gift: Gift,
    shopping: ShoppingBag,
    star: Star,
    tv: Tv,
    phone: Phone,
    tablet: Tablet,
    monitor: Monitor,
    printer: Printer,
    speaker: Speaker,
    keyboard: Keyboard,
    mouse: Mouse,
    coffee: Coffee,
    book: Book,
    bike: Bike,
    car: Car,
    plane: Plane,
    music: Music,
    film: Film,
    palette: Palette,
    // Default
    default: Package
}

interface Category {
    id: number
    name: string
    slug: string
    icon?: string
    product_count?: number
}

export default function CategoriesPage() {
    const [categories, setCategories] = React.useState<Category[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/categories?hideEmpty=true')
            .then(res => res.json())
            .then(data => {
                setCategories(Array.isArray(data) ? data : [])
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen pt-24 flex items-center justify-center">
                <div className="text-slate-500">Yükleniyor...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12">
            <div className="container mx-auto px-4">
                <div className="text-center mb-12">
                    <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Tüm Kategoriler</h1>
                    <p className="text-slate-500 max-w-xl mx-auto">
                        Kategorilere göz atarak ilginizi çeken ürünleri keşfedin
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {categories.map((category) => {
                        const IconComponent = iconMap[category.icon || 'default'] || iconMap.default

                        return (
                            <Link
                                key={category.id}
                                href={`/${category.slug}`}
                                className="group bg-white rounded-2xl p-6 flex flex-col items-center text-center shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 hover:-translate-y-1 transition-all duration-200"
                            >
                                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mb-4 group-hover:from-slate-200 group-hover:to-slate-300 transition-colors">
                                    <IconComponent className="w-10 h-10 text-slate-700" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-2 text-lg">{category.name}</h3>
                                {category.product_count !== undefined && (
                                    <span className="text-sm text-slate-500">
                                        {category.product_count > 0 ? `${category.product_count} ürün` : 'Ürün yok'}
                                    </span>
                                )}
                                <div className="mt-3 flex items-center gap-1 text-sm text-slate-400 group-hover:text-slate-600 transition-colors">
                                    <span>Keşfet</span>
                                    <ChevronRight className="w-4 h-4" />
                                </div>
                            </Link>
                        )
                    })}
                </div>

                {categories.length === 0 && (
                    <div className="text-center py-16">
                        <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">Henüz kategori eklenmemiş</p>
                    </div>
                )}
            </div>
        </div>
    )
}
