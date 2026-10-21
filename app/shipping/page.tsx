import { permanentRedirect } from 'next/navigation'

// The canonical copy of this page is the CMS page /page/shipping/ (Admin › Sayfalar). The old hard-coded
// copy (with placeholder contact details) is gone; /shipping/ answers 308 → /page/shipping/ (docs/SEO.md §1).
export default function ShippingRedirect(): never {
    permanentRedirect('/page/shipping/')
}
