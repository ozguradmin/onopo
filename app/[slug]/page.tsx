
import CategoryClient from "./CategoryClient"

export const runtime = "edge"

export default async function Page(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params
    return <CategoryClient slug={params.slug} />
}
