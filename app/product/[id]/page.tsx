
import ProductClient from "./ProductClient"

export const runtime = "edge"

export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    return <ProductClient id={params.id} />
}
