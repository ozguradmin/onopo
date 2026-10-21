"use client"

import * as React from 'react'
import { HeroSection } from '@/components/home/HeroSection'
import ProductShowcase from '@/components/home/ProductShowcase'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ImageCardSection } from '@/components/home/ImageCardSection'
import { CategoriesSection } from '@/components/home/CategoriesSection'
import type { HomeSection, Product } from '@/lib/catalog'

interface HomePageClientProps {
    /** Active sections in admin order, products already selected on the server (lib/catalog getHomepageSections). */
    sections: HomeSection[]
    /** Used only when the admin has no active section (newest in-stock products). */
    fallbackProducts: Product[]
}

export default function HomePageClient({ sections, fallbackProducts }: HomePageClientProps) {
    return (
        <div className="flex flex-col min-h-screen">
            {/* Default layout if no sections */}
            {(!sections || sections.length === 0) && (
                <>
                    <HeroSection />
                    <ProductShowcase products={fallbackProducts.slice(0, 8)} />
                    <FeaturesSection />
                </>
            )}

            {sections && sections.map((section, index) => {
                const config = section.config || {}
                const isLast = index === sections.length - 1

                let content = null

                if (section.type === 'hero') {
                    content = <HeroSection key={section.id} />
                } else if (section.type === 'new_products' || section.type === 'products') {
                    content = (
                        <ProductShowcase
                            key={section.id}
                            title={section.title}
                            description={config.description}
                            products={section.products ?? []}
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
