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

interface CategoriesSectionProps {
    title?: string
    categories?: Category[]
}

export function CategoriesSection({ title = "Kategoriler", categories: propCategories }: CategoriesSectionProps) {
    const [categories, setCategories] = React.useState<Category[]>(propCategories || [])

    React.useEffect(() => {
        if (!propCategories || propCategories.length === 0) {
            fetch('/api/categories')
                .then(res => res.json())
                .then(data => {
                    // Filter categories with products
                    const catsWithProducts = (data || []).filter((c: Category) => c.product_count && c.product_count > 0)
                    setCategories(catsWithProducts)
                })
                .catch(() => { })
        }
    }, [propCategories])

    const displayCategories = categories.slice(0, 6)

    return (
        <section className="py-16 bg-white">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl md:text-3xl font-bold font-heading text-slate-900">{title}</h2>
                    <Link
                        href="/categories"
                        className="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                        Tümünü Gör <ChevronRight className="w-4 h-4" />
                    </Link>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {displayCategories.map((category) => {
                        const IconComponent = iconMap[category.icon || 'default'] || iconMap.default

                        return (
                            <Link
                                key={category.id}
                                href={`/${category.slug}`}
                                className="group bg-slate-50 rounded-2xl p-6 flex flex-col items-center text-center hover:bg-slate-100 hover:scale-105 transition-all duration-200"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:shadow-md transition-shadow">
                                    <IconComponent className="w-8 h-8 text-slate-700" />
                                </div>
                                <h3 className="font-semibold text-slate-900 mb-1">{category.name}</h3>
                                {category.product_count !== undefined && category.product_count > 0 && (
                                    <span className="text-xs text-slate-500">{category.product_count} ürün</span>
                                )}
                            </Link>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
