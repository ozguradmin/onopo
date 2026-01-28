"use client"

import { Truck, ShieldCheck, MapPin, HeadphonesIcon } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const features = [
    {
        title: "Ücretsiz Kargo",
        description: "500 TL üzeri tüm elektronik siparişlerinde. Kapınıza kadar hızlı ve güvenilir teslimat.",
        icon: Truck,
        className: "bg-blue-600 text-white shadow-blue-900/20 shadow-lg", // Premium colors
    },
    {
        title: "Mardin'in Kalbi",
        description: "Global tasarlandı, yerel köklerden beslendi. Yerel zanaatkarları destekliyoruz.",
        icon: MapPin,
        className: "bg-slate-900 text-white shadow-slate-900/20 shadow-lg",
    },
    {
        title: "Güvenli Ödeme",
        description: "256-bit SSL şifreleme. Verileriniz bizimle her zaman güvende.",
        icon: ShieldCheck,
        className: "bg-white text-slate-900 border-slate-200 shadow-lg",
    },
    {
        title: "7/24 Destek",
        description: "Ekibimiz her zaman, her yerde size yardımcı olmak için burada.",
        icon: HeadphonesIcon,
        className: "bg-emerald-600 text-white shadow-emerald-900/20 shadow-lg",
    },
]

interface FeaturesSectionProps {
    title?: string
    features?: any[]
}

const iconMap: any = {
    truck: Truck,
    shield: ShieldCheck,
    map: MapPin,
    headphones: HeadphonesIcon
}

export function FeaturesSection({ title = "Neden Onopo?", features: custFeatures }: FeaturesSectionProps) {
    const displayFeatures = custFeatures || features
    return (
        <section className="py-20 bg-slate-50 border-y border-slate-200">
            <div className="container mx-auto px-4">
                <div className="mb-12 text-center">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">{title}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    {displayFeatures.map((feature: any, index: number) => {
                        // Resolve icon component
                        const IconComponent = typeof feature.icon === 'string'
                            ? (iconMap[feature.icon.toLowerCase()] || Truck)
                            : feature.icon

                        return (
                            <div key={index} className="flex flex-col items-center text-center group">
                                <div className="w-16 h-16 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 group-hover:shadow-md">
                                    <IconComponent className="w-8 h-8 text-slate-700" strokeWidth={1.5} />
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">{feature.title}</h3>
                                <p className="text-sm text-slate-500 max-w-[200px] leading-relaxed">
                                    {feature.description}
                                </p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section >
    )
}
