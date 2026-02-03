import * as React from 'react'
import { getDB } from '@/lib/db'
import { HeroSection } from '@/components/home/HeroSection'
import ProductShowcase from '@/components/home/ProductShowcase'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ImageCardSection } from '@/components/home/ImageCardSection'
import { CategoriesSection } from '@/components/home/CategoriesSection'
import { unstable_cache } from 'next/cache'

// force-dynamic required because DB not available at build time
// CDN caching is handled via Cache-Control headers in next.config.ts
export const dynamic = 'force-dynamic'

// Cached data fetcher
const getCachedHomepageData = unstable_cache(
  async () => {
    const db = await getDB()

    // Fetch active sections
    const { results: sections } = await db.prepare(
      'SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC'
    ).all()

    // Pre-fetch products - LIMIT 30 for CPU optimization
    const { results: allProducts } = await db.prepare(
      'SELECT id, name, slug, price, original_price, stock, images, category FROM products WHERE is_active = 1 ORDER BY id DESC LIMIT 30'
    ).all()

    // Parse images once for all products
    const productsWithImages = allProducts.map((p: any) => {
      let images: string[] = []
      try {
        images = p.images ? JSON.parse(p.images) : []
      } catch {
        images = []
      }
      return { ...p, images }
    })

    return { sections, productsWithImages }
  },
  ['homepage-data'],
  { revalidate: 300, tags: ['homepage'] } // Cache for 5 minutes
)

export default async function Home() {
  const { sections, productsWithImages } = await getCachedHomepageData()

  // Helper to filter products from pre-fetched list (no DB call!)
  const getProductsForSection = (configString: string, shuffle: boolean = false) => {
    try {
      const config = JSON.parse(configString || '{}')
      let filtered = [...productsWithImages]

      if (config.selection_type === 'category' && config.category) {
        filtered = filtered.filter(p => p.category && p.category.toLowerCase() === config.category.toLowerCase())
      } else if (config.selection_type === 'manual' && config.product_ids && config.product_ids.length > 0) {
        filtered = filtered.filter(p => config.product_ids.includes(p.id))
      }

      // Shuffle if requested (for 'products' section type)
      if (shuffle) {
        for (let i = filtered.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [filtered[i], filtered[j]] = [filtered[j], filtered[i]]
        }
      }

      return filtered.slice(0, config.limit || 8)
    } catch (e) {
      console.error('Product fetch error:', e)
      return []
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* If no sections, show default layout as fallback */}
      {(!sections || sections.length === 0) && (
        <>
          <HeroSection />
          <ProductShowcase />
          <FeaturesSection />
        </>
      )}

      {sections && sections.map(async (section: any, index: number) => {
        const config = JSON.parse(section.config || '{}')
        const isLast = index === sections.length - 1

        let content = null

        if (section.type === 'hero') {
          content = <HeroSection key={section.id} />
        } else if (section.type === 'new_products') {
          const products = getProductsForSection(section.config, false)
          content = (
            <ProductShowcase
              key={section.id}
              title={section.title}
              description={config.description}
              products={products}
              category={config.selection_type === 'category' ? config.category : undefined}
            />
          )
        } else if (section.type === 'products') {
          const products = getProductsForSection(section.config, true)
          content = (
            <ProductShowcase
              key={section.id}
              title={section.title}
              description={config.description}
              products={products}
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
          // Render custom HTML/CSS code
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
