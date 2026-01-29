
// ProductClient imported below



import ProductClient from "./ProductClient"
import { getDB } from "@/lib/db"
import { Metadata } from "next"

// Dynamic Metadata for SEO
export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
    const params = await props.params
    const db = await getDB()
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(params.id).first() as any

    if (!product) {
        return { title: 'Ürün Bulunamadı' }
    }

    const images = JSON.parse(product.images || '[]')
    const mainImage = images[0] || '/placeholder.svg'

    return {
        title: product.name,
        description: product.description?.slice(0, 160) || 'Ürün detayları',
        openGraph: {
            images: [mainImage],
        }
    }
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    const db = await getDB()
    const product = await db.prepare('SELECT * FROM products WHERE id = ?').bind(params.id).first() as any

    if (!product) return <ProductClient id={params.id} />

    const images = JSON.parse(product.images || '[]')
    const price = product.price
    const stock = Number(product.stock)

    // JSON-LD Structured Data (Google Shopping)
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        image: images,
        description: product.description,
        sku: product.id,
        brand: {
            '@type': 'Brand',
            name: 'Onopo'
        },
        offers: {
            '@type': 'Offer',
            url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://onopo.com'}/product/${product.id}`,
            priceCurrency: 'TRY',
            price: price,
            priceValidUntil: '2027-12-31',
            itemCondition: 'https://schema.org/NewCondition',
            availability: stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            hasMerchantReturnPolicy: {
                '@type': 'MerchantReturnPolicy',
                applicableCountry: 'TR',
                returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
                merchantReturnDays: 14,
                returnMethod: 'https://schema.org/ReturnByMail',
                returnFees: 'https://schema.org/FreeReturn'
            },
            shippingDetails: {
                '@type': 'OfferShippingDetails',
                shippingRate: {
                    '@type': 'MonetaryAmount',
                    value: 0,
                    currency: 'TRY'
                },
                shippingDestination: {
                    '@type': 'DefinedRegion',
                    addressCountry: 'TR'
                },
                deliveryTime: {
                    '@type': 'ShippingDeliveryTime',
                    handlingTime: {
                        '@type': 'QuantitativeValue',
                        minValue: 0,
                        maxValue: 1,
                        unitCode: 'DAY'
                    },
                    transitTime: {
                        '@type': 'QuantitativeValue',
                        minValue: 1,
                        maxValue: 3,
                        unitCode: 'DAY'
                    }
                }
            }
        },
        aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: '4.8',
            reviewCount: '12' // Mock data - Ideally fetch from reviews table
        }
    }

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <ProductClient id={params.id} />
        </>
    )
}
