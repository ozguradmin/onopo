
import ProductClient from "./ProductClient"



export default async function Page(props: { params: Promise<{ id: string }> }) {
    const params = await props.params
    return <ProductClient id={params.id} />
}
