import { permanentRedirect } from 'next/navigation'

// The old client-rendered category index listed empty categories and had no canonical. Categories now
// have their own /kategori/<slug>/ pages and the all-products listing filters by category, so the old
// URL moves there permanently.
export default function CategoriesPage(): never {
    permanentRedirect('/products/')
}
