"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowRight, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"

export function HeroSection() {
    const [currentSlide, setCurrentSlide] = React.useState(0)
    const [slides, setSlides] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/hero')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    setSlides(data)
                } else {
                    // Fallback to defaults if DB is empty or fails
                    setSlides([
                        {
                            id: 1,
                            title: "Teknoloji'nin Geleceği",
                            subtitle: "Uzun ömürlü kullanım için tasarlanmış premium kablolar, şarj cihazları ve gadget'lar.",
                            button_text: "Teknolojiyi Keşfet",
                            button_link: "/tech",
                            image_url: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=2101&auto=format&fit=crop",
                        },
                        {
                            id: 2,
                            title: "Rose Cosmetics: Işılda",
                            subtitle: "Profesyonel makyaj araçları ve cilt bakımı temelleri.",
                            button_text: "Güzelliği Keşfet",
                            button_link: "/beauty",
                            image_url: "https://images.unsplash.com/photo-1596462502278-27bfdd403cc2?q=80&w=2070&auto=format&fit=crop",
                        }
                    ])
                }
                setLoading(false)
            })
            .catch(() => setLoading(false))
    }, [])

    React.useEffect(() => {
        if (slides.length === 0) return

        // User requested 2-3x slower: 5000 -> 12000
        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % slides.length)
        }, 12000)
        return () => clearInterval(timer)
    }, [slides.length])

    if (loading) return <div className="h-[90vh] bg-slate-950 flex items-center justify-center text-white">Yükleniyor...</div>
    if (slides.length === 0) return null

    const slide = slides[currentSlide]

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
                        style={{
                            backgroundImage: `url(${slide.image_url || slide.image})`,
                            backgroundPosition: 'center center'
                        }}
                    >
                        {/* 20% black overlay as requested + gradient */}
                        <div className="absolute inset-0 bg-black/20" />
                        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="relative h-full container mx-auto px-4 flex flex-col justify-center items-start z-10">
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2, duration: 0.6 }}
                            className="max-w-3xl"
                        >
                            {/* Removed 'Yeni Koleksiyon 2026' as requested */}

                            <h1 className="text-5xl md:text-7xl font-bold text-white font-heading tracking-tight mb-6 leading-tight drop-shadow-lg">
                                {slide.title || slide.headline}
                            </h1>
                            <p className="text-xl md:text-2xl text-slate-100 mb-10 max-w-lg leading-relaxed drop-shadow-md">
                                {slide.subtitle || slide.subheadline}
                            </p>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <a href={slide.button_link || slide.link}>
                                    <Button size="lg" className="w-full sm:w-auto rounded-full text-lg px-10 h-14 bg-white text-slate-950 hover:bg-slate-200 transition-all shadow-xl hover:-translate-y-1 font-semibold">
                                        {slide.button_text || slide.cta} <ArrowRight className="ml-2 w-5 h-5" />
                                    </Button>
                                </a>
                            </div>
                        </motion.div>
                    </div>
                </motion.div>

            </AnimatePresence>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-24 left-0 right-0 z-20 flex justify-center pointer-events-none"
            >
                <motion.div
                    animate={{ y: [0, 10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    className="flex flex-col items-center gap-2 text-white/50"
                >
                    <span className="text-xs uppercase tracking-widest font-medium">Kaydır</span>
                    <ArrowDown className="w-6 h-6" />
                </motion.div>
            </motion.div>

            {/* Slider Controls */}
            {
                slides.length > 1 && (
                    <div className="absolute bottom-10 left-0 right-0 z-20">
                        <div className="container mx-auto px-4 flex justify-center gap-3">
                            {slides.map((s, index) => (
                                <button
                                    key={s.id || index}
                                    onClick={() => setCurrentSlide(index)}
                                    className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${index === currentSlide ? "w-12 bg-white" : "w-6 bg-white/40 hover:bg-white/60"
                                        }`}
                                    aria-label={`Go to slide ${index + 1}`}
                                />
                            ))}
                        </div>
                    </div>
                )
            }
        </section >
    )
}
