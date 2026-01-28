import { getDB } from '@/lib/db'
import { HeroSection } from '@/components/home/HeroSection'
import ProductShowcase from '@/components/home/ProductShowcase'
import { FeaturesSection } from '@/components/home/FeaturesSection'
import { ImageCardSection } from '@/components/home/ImageCardSection'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const db = await getDB()

  // Fetch active sections
  const { results: sections } = await db.prepare(
    'SELECT * FROM homepage_sections WHERE is_active = 1 ORDER BY display_order ASC'
  ).all()

  // Setup helper to fetch products based on config
  const getProductsForSection = async (configString: string) => {
    try {
      const config = JSON.parse(configString || '{}')
      let query = 'SELECT * FROM products'
      const params: any[] = []

      if (config.selection_type === 'category' && config.category) {
        query += ' WHERE category = ?'
        params.push(config.category)
      } else if (config.selection_type === 'manual' && config.product_ids && config.product_ids.length > 0) {
        const placeholders = config.product_ids.map(() => '?').join(',')
        query += ` WHERE id IN (${placeholders})`
        params.push(...config.product_ids)
      }

      query += ' LIMIT ?'
      params.push(config.limit || 8)

      const { results } = await db.prepare(query).bind(...params).all()
      // Retrieve images for products
      const productsWithImages = await Promise.all(results.map(async (p: any) => {
        const { results: images } = await db.prepare('SELECT url FROM product_images WHERE product_id = ?').bind(p.id).all()
        return {
          ...p,
          images: images.map((i: any) => i.url)
        }
      }))
      return productsWithImages
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

        if (section.type === 'products') {
          const products = await getProductsForSection(section.config)
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

        return null
      })}
    </div>
  )
}
