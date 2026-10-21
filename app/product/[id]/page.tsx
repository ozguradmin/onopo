import { notFound, permanentRedirect } from 'next/navigation'
import { resolveProductIdCached } from '@/lib/seo-routing'

/**
 * /product/<id>/ is a legacy duplicate of the product page: 308 to the canonical /<slug>/ of an
 * active product, 404 for unknown or inactive ids (docs/SEO.md §1, §5). No metadata needed.
 */
export default async function ProductIdPage({ params }: { params: Promise<{ id: string }> }) {
    const r = await resolveProductIdCached((await params).id)
    if (!r) notFound()
    permanentRedirect(r.path)
}
