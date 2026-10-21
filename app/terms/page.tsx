import { permanentRedirect } from 'next/navigation'

// The canonical copy of this page is the CMS page /page/terms/ (Admin › Sayfalar). The old hard-coded
// copy (with placeholder contact details) is gone; /terms/ answers 308 → /page/terms/ (docs/SEO.md §1).
export default function TermsRedirect(): never {
    permanentRedirect('/page/terms/')
}
