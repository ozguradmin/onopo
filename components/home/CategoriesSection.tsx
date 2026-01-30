'use client'

import * as React from 'react'
import Link from 'next/link'
import {
    Laptop, Sparkles, Gamepad2, Package, Zap, Heart,
    Shirt, Home, Camera, Headphones, Watch, Gift,
    ShoppingBag, Star, Tv, Phone, Tablet, Monitor,
    Printer, Speaker, Keyboard, Mouse, Coffee, Book,
    Bike, Car, Plane, Music, Film, Palette, ChevronRight,
    Calculator, Utensils, Armchair, Dumbbell, Dog, Flower2,
    Briefcase, Hammer, Baby, Scissors, Anchor, Sun,
    Moon, Cloud, Umbrella, Key, Lock, Map, Compass,
    Globe, Award, Medal, Crown, Trophy
} from 'lucide-react'

// Icon mapping for categories
// Icon mapping for categories matches Admin Panel
const iconMap: Record<string, any> = {
    laptop: Laptop,
    sparkles: Sparkles,
    gamepad: Gamepad2,
    package: Package,
    zap: Zap,
    tool: Hammer,
    heart: Heart,
    shirt: Shirt,
    home: Home,
    furniture: Armchair,
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
    kitchen: Utensils,
    book: Book,
    bike: Bike,
    car: Car,
    plane: Plane,
    music: Music,
    film: Film,
    palette: Palette,
    office: Briefcase,
    baby: Baby,
    sport: Dumbbell,
    pet: Dog,
    garden: Flower2,
    beauty: Scissors,
    sea: Anchor,
    sun: Sun,
    moon: Moon,
    weather: Cloud,
    umbrella: Umbrella,
    security: Lock,
    map: Map,
    global: Globe,
    award: Award,
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
            fetch('/api/categories?hideEmpty=true')
                .then(res => res.json())
                .then(data => {
                    setCategories(Array.isArray(data) ? data : [])
                })
                .catch(() => { })
        }
    }, [propCategories])

    const displayCategories = categories.filter(c => c.product_count && c.product_count > 0).slice(0, 6)

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
                                href={`/products?category=${encodeURIComponent(category.name)}`}
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
