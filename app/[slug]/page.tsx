
import CategoryClient from "./CategoryClient"
import { notFound } from "next/navigation"

const VALID_CATEGORIES = ['tech', 'gaming', 'beauty', 'products', 'new']

export default async function Page(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params

    // If not a valid category, this should be a 404
    if (!VALID_CATEGORIES.includes(params.slug)) {
        notFound()
    }

    return <CategoryClient slug={params.slug} />
}
