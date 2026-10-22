import 'server-only'
import { getActiveProducts, type Product } from '@/lib/catalog'
import { guideImagesBySlug, selectGuideProducts, type Guide, type GuideImage, type GuideSlug } from '@/lib/guides'

export interface GuideProducts {
    products: Product[]
    /** The catalogue could not be read: the page renders without products and is not edge-cached. */
    failed: boolean
}

/**
 * The related products of a guide, live from D1 (getActiveProducts: one query per request, shared with the
 * layout). Prices and stock are never part of the guide data; the cards show what checkout charges.
 */
export async function getGuideProducts(guide: Guide, limit = 8): Promise<GuideProducts> {
    try {
        return { products: selectGuideProducts(await getActiveProducts(), guide.products, limit), failed: false }
    } catch (error) {
        console.error('[rehber] related products could not be loaded', error)
        return { products: [], failed: true }
    }
}

export interface GuideImages {
    /** Each guide's product photos (lib/guides selectGuideImages); empty lists when the catalogue could not be read. */
    images: Partial<Record<GuideSlug, GuideImage[]>>
    /** The catalogue could not be read: the pictures are missing, so the page must not be edge-cached. */
    failed: boolean
}

/** Every guide's photos from the live catalogue (the same getActiveProducts call as the rest of the request). */
export async function getGuideImages(): Promise<GuideImages> {
    try {
        return { images: guideImagesBySlug(await getActiveProducts()), failed: false }
    } catch (error) {
        console.error('[rehber] guide pictures could not be loaded', error)
        return { images: {}, failed: true }
    }
}
