import { permanentRedirect } from 'next/navigation'

// The canonical copy of this page is the CMS page /page/help/ (Admin › Sayfalar). The old hard-coded
// copy (with placeholder contact details) is gone; /help/ answers 308 → /page/help/ (docs/SEO.md §1).
export default function HelpRedirect(): never {
    permanentRedirect('/page/help/')
}
