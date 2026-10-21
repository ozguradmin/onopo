import type { Metadata } from 'next'
import { privatePageMetadata } from '@/lib/seo'

// The page is a client component, so its metadata lives here: plain title, never indexed.
export const metadata: Metadata = {
    title: 'Giriş yap',
    ...privatePageMetadata,
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return children
}
