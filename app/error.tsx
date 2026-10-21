'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Home, RotateCw } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'

/**
 * Route-level error UI (a page or its server data failed). Friendly retry, never an automatic reload.
 * "Tekrar dene" re-fetches the server components of the route (router.refresh) and re-renders the
 * segment (reset) in one transition — what Next's own `retry` prop does — so server errors (e.g. a D1
 * hiccup) can recover too; the transition also drives the button's pending state.
 * The data-onopo-nocache marker keeps the edge cache from storing this response.
 */
export default function RouteError({ error, reset }: { error: unknown; reset: () => void }) {
    const router = useRouter()
    const [pending, startTransition] = React.useTransition()
    const headingRef = React.useRef<HTMLHeadingElement>(null)
    const digest = error instanceof Error ? (error as Error & { digest?: string }).digest : undefined

    React.useEffect(() => {
        console.error('[route-error]', error)
        headingRef.current?.focus()
    }, [error])

    const retry = () => {
        startTransition(() => {
            router.refresh()
            reset()
        })
    }

    return (
        <div className="min-h-[60vh] bg-surface">
            <div hidden data-onopo-nocache="" />
            <div className="container-store py-12 lg:py-20">
                <div className="mx-auto max-w-lg rounded-sheet border border-line bg-white p-6 text-center shadow-card sm:p-10">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning" aria-hidden="true">
                        <AlertTriangle className="h-7 w-7" />
                    </span>
                    <h1 ref={headingRef} tabIndex={-1} className="type-h1 mt-5 text-ink outline-none">
                        Bir sorun oluştu
                    </h1>
                    <p className="mt-3 text-[15px] leading-6 text-muted">
                        Sayfa yüklenirken beklenmedik bir hata oldu. Tekrar deneyebilir ya da ana sayfaya dönebilirsin.
                    </p>
                    <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={retry}
                            disabled={pending}
                            aria-busy={pending || undefined}
                            className={buttonClasses({ variant: 'brand', size: '48' })}
                        >
                            <RotateCw className={pending ? 'h-[18px] w-[18px] animate-spin' : 'h-[18px] w-[18px]'} aria-hidden="true" />
                            {pending ? 'Deneniyor…' : 'Tekrar dene'}
                        </button>
                        <Link href="/" className={buttonClasses({ variant: 'outline-ink', size: '48' })}>
                            <Home className="h-[18px] w-[18px]" aria-hidden="true" /> Ana sayfa
                        </Link>
                    </div>
                    {digest && <p className="mt-6 text-xs text-subtle">Hata kodu: <span className="font-mono">{digest}</span></p>}
                </div>
            </div>
        </div>
    )
}
