import { serializeJsonLd } from '@/lib/seo'

/**
 * Renders schema.org JSON-LD. Pass one object or an array (one <script> per object).
 * Build the objects with the helpers in lib/seo.ts (organizationJsonLd, websiteJsonLd, breadcrumbJsonLd,
 * productJsonLd, itemListJsonLd). Works in server and client components; render it in the server HTML.
 * "<" is escaped, so product names or descriptions can never close the tag.
 */
export function JsonLd({ data, pretty = false, id }: { data: unknown; pretty?: boolean; id?: string }) {
    const items = (Array.isArray(data) ? data : [data]).filter((d): d is object => Boolean(d))
    return (
        <>
            {items.map((item, i) => (
                <script
                    key={i}
                    id={id && items.length === 1 ? id : undefined}
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: serializeJsonLd(item, pretty) }}
                />
            ))}
        </>
    )
}

export default JsonLd
