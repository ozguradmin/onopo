import { permanentRedirect } from 'next/navigation'

// The canonical copy of this page is the CMS page /page/policy/ (Admin › Sayfalar). The old hard-coded
// copy (with placeholder contact details) is gone; /policy/ answers 308 → /page/policy/ (docs/SEO.md §1).
export default function PolicyRedirect(): never {
    permanentRedirect('/page/policy/')
}
