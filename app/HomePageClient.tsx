"use client"

import * as React from 'react'
import { HeroSection } from '@/components/home/HeroSection'
import ProductShowcase from '@/components/home/ProductShowcase'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ImageCardSection } from '@/components/home/ImageCardSection'
import { CategoriesSection } from '@/components/home/CategoriesSection'

// Loading skeleton component
function HomeSkeleton() {
    return (
        <div className="flex flex-col min-h-screen animate-pulse">
            {/* Hero Skeleton */}
            <div className="h-[400px] bg-slate-100" />

            {/* Products Skeleton */}
            <div className="container mx-auto px-4 py-12">
                <div className="h-8 bg-slate-200 rounded w-48 mb-8" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="aspect-square bg-slate-100 rounded-2xl" />
                    ))}
                </div>
            </div>
        </div>
    )
}

export default function HomePageClient() {
    const [sections, setSections] = React.useState<any[]>([])
    const [products, setProducts] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        // Fetch data client-side to avoid SSR CPU usage
        Promise.all([
            fetch('/api/homepage-sections').then(r => r.json()),
            fetch('/api/products?limit=30').then(r => r.json())
        ])
            .then(([sectionsData, productsData]) => {
                setSections(Array.isArray(sectionsData) ? sectionsData : [])
                setProducts(Array.isArray(productsData) ? productsData : [])
                setLoading(false)
            })
            .catch(() => {
                setLoading(false)
            })
    }, [])

    // Helper to filter products - config is already an object from API
    const getProductsForSection = React.useCallback((config: any, shuffle: boolean = false) => {
        try {
            // Config is already an object, no need to parse
            const cfg = config || {}
            let filtered = [...products]

            if (cfg.selection_type === 'category' && cfg.category) {
                filtered = filtered.filter(p => p.category && p.category.toLowerCase() === cfg.category.toLowerCase())
            } else if (cfg.selection_type === 'manual' && cfg.product_ids && cfg.product_ids.length > 0) {
                filtered = filtered.filter(p => cfg.product_ids.includes(p.id))
            }

            if (shuffle) {
                for (let i = filtered.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filtered[i], filtered[j]] = [filtered[j], filtered[i]]
                }
            }

            return filtered.slice(0, cfg.limit || 8)
        } catch {
            return []
        }
    }, [products])

    if (loading) {
        return <HomeSkeleton />
    }

    return (
        <div className="flex flex-col min-h-screen">
            {/* Default layout if no sections */}
            {(!sections || sections.length === 0) && (
                <>
                    <HeroSection />
                    <ProductShowcase products={products.slice(0, 8)} />
                    <FeaturesSection />
                </>
            )}

            {sections && sections.map((section: any, index: number) => {
                // Config is already parsed by the API
                const config = section.config || {}
                const isLast = index === sections.length - 1

                let content = null

                if (section.type === 'hero') {
                    content = <HeroSection key={section.id} />
                } else if (section.type === 'new_products') {
                    const sectionProducts = getProductsForSection(config, false)
                    content = (
                        <ProductShowcase
                            key={section.id}
                            title={section.title}
                            description={config.description}
                            products={sectionProducts}
                            category={config.selection_type === 'category' ? config.category : undefined}
                        />
                    )
                } else if (section.type === 'products') {
                    const sectionProducts = getProductsForSection(config, true)
                    content = (
                        <ProductShowcase
                            key={section.id}
                            title={section.title}
                            description={config.description}
                            products={sectionProducts}
                            category={config.selection_type === 'category' ? config.category : undefined}
                        />
                    )
                } else if (section.type === 'features') {
                    content = (
                        <FeaturesSection
                            key={section.id}
                            title={section.title}
                            features={config.items}
                        />
                    )
                } else if (section.type === 'image_card') {
                    content = (
                        <ImageCardSection
                            key={section.id}
                            title={section.title}
                            image_url={config.image_url}
                            link_url={config.link_url}
                        />
                    )
                } else if (section.type === 'categories') {
                    content = (
                        <CategoriesSection
                            key={section.id}
                            title={section.title || 'Kategoriler'}
                        />
                    )
                } else if (section.type === 'custom_code') {
                    const htmlContent = config.html_content || ''
                    content = (
                        <div
                            key={section.id}
                            className="custom-code-section"
                            dangerouslySetInnerHTML={{ __html: htmlContent }}
                        />
                    )
                }

                if (!content) return null

                return (
                    <React.Fragment key={section.id}>
                        {content}
                        {!isLast && section.type !== 'hero' && (
                            <div className="container mx-auto px-4">
                                <hr className="border-slate-100" />
                            </div>
                        )}
                    </React.Fragment>
                )
            })}
        </div>
    )
}
