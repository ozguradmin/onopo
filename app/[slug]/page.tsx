
import CategoryClient from "./CategoryClient"



export default async function Page(props: { params: Promise<{ slug: string }> }) {
    const params = await props.params
    return <CategoryClient slug={params.slug} />
}
