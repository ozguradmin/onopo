import { serializeJsonLd } from '@/lib/seo'

/**
 * Renders schema.org JSON-LD. Pass one object or an array (one <script> per object).
 * Build the objects with the helpers in lib/seo.ts (organizationJsonLd, websiteJsonLd, breadcrumbJsonLd,
 * productJsonLd, itemListJsonLd). Works in server and client components; render it in the server HTML.
 */
export function JsonLd({ data, pretty = false }: { data: object | Array<object | null | undefined | false>; pretty?: boolean }) {
    const items = (Array.isArray(data) ? data : [data]).filter((d): d is object => Boolean(d))
    return (
        <>
            {items.map((item, i) => (
                <script
                    key={i}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(item, pretty) }}
                />
            ))}
        </>
    )
}

export default JsonLd
