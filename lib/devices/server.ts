import 'server-only'
import { cache } from 'react'
import { getActiveProducts, type Product } from '@/lib/catalog'
import { canonicalUrl } from '@/lib/seo'
import { buildDeviceCatalog, devicePageForProduct, devicePagePaths, type DeviceCatalog, type DevicePage } from '@/lib/devices'

export interface DeviceData {
    catalog: DeviceCatalog
    /** Active products, newest first (getActiveProducts). */
    products: Product[]
}

/**
 * The device pages of the live catalogue (getActiveProducts: one query per request, shared with the layout and
 * the product page). Throws when D1 is unavailable: without the catalogue no page can be known (500, not 404).
 */
export const getDeviceData = cache(async (): Promise<DeviceData> => {
    const products = await getActiveProducts()
    return { catalog: buildDeviceCatalog(products), products }
})

/** The device page a product page links to ("Bu cihaz için diğer ürünler"), or null (also when D1 fails). */
export async function getDevicePageForProduct(product: { name: string }): Promise<DevicePage | null> {
    try {
        return devicePageForProduct((await getDeviceData()).catalog, product)
    } catch (error) {
        console.error('[cihaz] device link could not be built', error)
        return null
    }
}

/**
 * Absolute canonical URLs of the indexable device pages (hub first), for llms.txt, IndexNow and similar lists.
 * Empty when there is none; throws when D1 is unavailable.
 */
export async function getDevicePageUrls(): Promise<string[]> {
    const { catalog, products } = await getDeviceData()
    return devicePagePaths(products, catalog).map(path => canonicalUrl(path))
}
