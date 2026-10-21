import type { Metadata } from 'next'
import { privatePageMetadata } from '@/lib/seo'

// The checkout page is a client component, so its metadata lives here: plain title, never indexed.
export const metadata: Metadata = {
    title: 'Ödeme',
    ...privatePageMetadata,
}

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
    return children
}
