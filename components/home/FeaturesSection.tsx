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

export function FeaturesSection({ title = "Neden Onopo'yu Seçmelisiniz?", features: custFeatures }: FeaturesSectionProps) {
    const displayFeatures = custFeatures || features
    return (
        <section className="py-24 container mx-auto px-4">
            <div className="mb-16 text-center">
                <h2 className="text-3xl lg:text-4xl font-bold font-heading tracking-tight mb-4 text-slate-900">
                    {title}
                </h2>
                <p className="text-slate-600 max-w-2xl mx-auto text-lg">
                    Size kalite ve hizmet taahhüdü ile en iyi teknoloji aksesuarlarını sunuyoruz.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {displayFeatures.map((feature: any, index: number) => (
                    <motion.div
                        key={feature.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1, duration: 0.5 }}
                        viewport={{ once: true }}
                        className={cn(
                            "rounded-[2rem] p-8 flex flex-col justify-start items-start relative overflow-hidden group hover:shadow-xl transition-all duration-300 border border-slate-100",
                            feature.className
                        )}
                    >
                        <div className="w-14 h-14 rounded-2xl bg-white/80 dark:bg-white/10 backdrop-blur-sm flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform duration-300">
                            <feature.icon className="w-7 h-7" />
                        </div>
                        <h3 className="text-2xl font-bold font-heading mb-3 tracking-tight">{feature.title}</h3>
                        <p className="text-base opacity-90 leading-relaxed font-medium">
                            {feature.description}
                        </p>

                        {/* Hover Gradient Effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                    </motion.div>
                ))}
            </div>
        </section >
    )
}
