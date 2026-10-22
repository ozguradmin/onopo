import type { Metadata } from 'next'
import { NotFoundView } from '@/components/status/status-islands'

// Real 404 page (HTTP 404 via notFound() or an unknown URL). No canonical (buildMetadata is not called).
// Next serialises this tree into the RSC payload of every page (root not-found boundary), so the view
// is one client component: every other page only carries a module reference, and the
// data-onopo-nocache marker is in the HTML only when the 404 is really rendered.
// Server HTML: an unknown multi-segment URL renders this page on the server. A notFound() thrown by a
// page does not: Next 16 answers 404 with an empty "__next_error__" document (head: this metadata) and
// renders the view in the browser; NotFoundHead keeps this title and noindex there.
export const metadata: Metadata = {
    title: 'Sayfa bulunamadı',
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
}

export default function NotFound() {
    return <NotFoundView />
}
