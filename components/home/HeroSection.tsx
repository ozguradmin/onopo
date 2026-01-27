"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const slides = [
    {
        id: 1,
        headline: "Teknoloji'nin Geleceği",
        subheadline: "Uzun ömürlü kullanım için tasarlanmış premium kablolar, şarj cihazları ve gadget'lar.",
        cta: "Teknolojiyi Keşfet",
        link: "/tech",
        image: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=2101&auto=format&fit=crop",
        color: "from-blue-600/20 to-purple-600/20",
        accent: "text-blue-400"
    },
    {
        id: 2,
        headline: "Rose Cosmetics: Işılda",
        subheadline: "Profesyonel makyaj araçları ve cilt bakımı temelleri.",
        cta: "Güzelliği Keşfet",
        link: "/beauty",
        image: "https://images.unsplash.com/photo-1596462502278-27bfdd403cc2?q=80&w=2070&auto=format&fit=crop",
        color: "from-rose-500/20 to-orange-400/20",
        accent: "text-rose-400"
    }
]

export function HeroSection() {
    const [currentSlide, setCurrentSlide] = React.useState(0)

    React.useEffect(() => {
        // User requested 2-3x slower: 5000 -> 12000
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length)
        }, 12000)
        return () => clearInterval(timer)
    }, [])

    return (
        <section className="relative h-[90vh] w-full overflow-hidden bg-slate-950">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.8 }}
                    className="absolute inset-0"
                >
                    {/* Background Image with Overlay */}
                    <div
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${slides[currentSlide].image})` }}
                    />
                    <div className={`absolute inset-0 bg-gradient-to-r ${slides[currentSlide].color} mix-blend-overlay`} />
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

                    {/* Content */}
                    <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-start z-10">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="max-w-2xl"
                        >
                            <span className={`inline-block py-1 px-3 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-sm font-medium mb-6 ${slides[currentSlide].accent}`}>
                                Yeni Koleksiyon 2026
                            </span>
                            <h1 className="text-5xl md:text-7xl font-bold text-white font-heading tracking-tight mb-6 leading-tight">
                                {slides[currentSlide].headline}
                            </h1>
                            <p className="text-xl text-slate-200 mb-8 max-w-lg leading-relaxed">
                                {slides[currentSlide].subheadline}
                            </p>
                            <div className="flex gap-4">
                                <a href={slides[currentSlide].link}>
                                    <Button size="lg" className="rounded-full text-base px-8 h-12 bg-white text-slate-950 hover:bg-slate-200 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1">
                                        {slides[currentSlide].cta} <ArrowRight className="ml-2 w-4 h-4" />
                                    </Button>
                                </a>
                                <a href={slides[currentSlide].link}>
                                    <Button variant="outline" size="lg" className="rounded-full text-base px-8 h-12 border-white/30 text-white hover:bg-white/10 hover:text-white transition-all">
                                        Koleksiyonu İncele
                                    </Button>
                                </a>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>
            </AnimatePresence>

            {/* Slider Controls */}
            <div className="absolute bottom-10 left-0 right-0 z-20">
                <div className="container mx-auto px-4 flex justify-center gap-3">
                    {slides.map((slide, index) => (
                        <button
                            key={slide.id}
                            onClick={() => setCurrentSlide(index)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${index === currentSlide ? "w-12 bg-white" : "w-6 bg-white/30 hover:bg-white/50"
                                }`}
                            aria-label={`Go to slide ${index + 1}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
