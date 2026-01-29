import { getDB } from '@/lib/db'
import { HeroSection } from '@/components/home/HeroSection'
import ProductShowcase from '@/components/home/ProductShowcase'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ImageCardSection } from '@/components/home/ImageCardSection'
import { CategoriesSection } from '@/components/home/CategoriesSection'
import { unstable_cache } from 'next/cache'

export const dynamic = 'force-dynamic'

// Cached data fetcher
const getCachedHomepageData = unstable_cache(
  async () => {
    const db = await getDB()

    // Fetch active sections
    const { results: sections } = await db.prepare(
      'SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC'
    ).all()

    // Pre-fetch ALL products once (cheaper than multiple queries)
    // Ordered by id DESC so newest products come first for new_products section
    const { results: allProducts } = await db.prepare(
      'SELECT id, name, slug, price, original_price, stock, images, category FROM products WHERE is_active = 1 ORDER BY id DESC LIMIT 50'
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
  { revalidate: 60 } // Cache for 60 seconds
)

export default async function Home() {
  const { sections, productsWithImages } = await getCachedHomepageData()

  // Helper to filter products from pre-fetched list (no DB call!)
  const getProductsForSection = (configString: string, shuffle: boolean = false) => {
    try {
      const config = JSON.parse(configString || '{}')
      let filtered = [...productsWithImages]

      if (config.selection_type === 'category' && config.category) {
        filtered = filtered.filter(p => p.category === config.category)
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

      {sections && sections.map(async (section: any) => {
        const config = JSON.parse(section.config || '{}')

        if (section.type === 'hero') {
          return <HeroSection key={section.id} />
        }

        if (section.type === 'new_products') {
          // New products: sorted by ID desc (newest first) - already sorted from DB
          const products = getProductsForSection(section.config, false)
          return (
            <ProductShowcase
              key={section.id}
              title={section.title}
              products={products}
            />
          )
        }

        if (section.type === 'products') {
          // Regular products: shuffled for variety
          const products = getProductsForSection(section.config, true)
          return (
            <ProductShowcase
              key={section.id}
              title={section.title}
              products={products}
            />
          )
        }

        if (section.type === 'features') {
          return (
            <FeaturesSection
              key={section.id}
              title={section.title}
              features={config.items}
            />
          )
        }

        if (section.type === 'image_card') {
          return (
            <ImageCardSection
              key={section.id}
              title={section.title}
              image_url={config.image_url}
              link_url={config.link_url}
            />
          )
        }

        if (section.type === 'categories') {
          return (
            <CategoriesSection
              key={section.id}
              title={section.title || 'Kategoriler'}
            />
          )
        }

        return null
      })}
    </div>
  )
}
