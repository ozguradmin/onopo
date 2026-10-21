'use client'

import * as React from 'react'
import { Component, ErrorInfo, ReactNode } from 'react'
import { unstable_rethrow, useRouter } from 'next/navigation'

interface Props {
    children: ReactNode
    /** Clears the error when it changes (pass the pathname so navigating away recovers). */
    resetKey?: string
    /** 'page' renders the fallback inside the store layout; 'root' is the last-resort full-screen one. */
    variant?: 'page' | 'root'
}

interface State {
    error: Error | null
}

const CHUNK_RELOAD_KEY = 'onopo:chunk-reload'

/** A stale deploy (old HTML asking for chunks that no longer exist) is the one error a reload fixes. */
function isChunkLoadError(error: unknown): boolean {
    const e = error as { name?: string; message?: string } | null
    if (!e) return false
    return e.name === 'ChunkLoadError' || /Loading (CSS )?chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i.test(e.message || '')
}

/** Reload at most once per path per 60 s (sessionStorage guard), so it can never loop. */
function reloadOnceForChunkError(): boolean {
    try {
        const raw = sessionStorage.getItem(CHUNK_RELOAD_KEY)
        const last = raw ? (JSON.parse(raw) as { path: string; at: number }) : null
        const path = window.location.pathname
        if (last && last.path === path && Date.now() - last.at < 60_000) return false
        sessionStorage.setItem(CHUNK_RELOAD_KEY, JSON.stringify({ path, at: Date.now() }))
        window.location.reload()
        return true
    } catch {
        return false
    }
}

/**
 * Error boundary with a visible Turkish fallback ("Bir sorun oluştu · Tekrar dene").
 * It never reloads the page by itself, except once for a ChunkLoadError after a deploy.
 * Next.js navigation signals (redirect / notFound) are re-thrown so Next handles them.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
    public state: State = { error: null }

    public static getDerivedStateFromError(error: Error): State {
        return { error }
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('[ErrorBoundary]', error, errorInfo?.componentStack)
        if (isChunkLoadError(error)) reloadOnceForChunkError()
    }

    public componentDidUpdate(prevProps: Props) {
        if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ error: null })
        }
    }

    private retry = () => {
        this.setState({ error: null })
    }

    public render() {
        const { error } = this.state
        if (error) {
            // Let Next.js handle redirect()/notFound() thrown below this boundary
            unstable_rethrow(error)
            return <ErrorFallback variant={this.props.variant ?? 'page'} onRetry={this.retry} />
        }
        return this.props.children
    }
}

function ErrorFallback({ variant, onRetry }: { variant: 'page' | 'root'; onRetry: () => void }) {
    const router = useRouter()
    const retry = () => {
        // Re-fetch the server components of this page, then render the subtree again
        React.startTransition(() => {
            router.refresh()
            onRetry()
        })
    }
    return (
        <div
            role="alert"
            className={
                variant === 'root'
                    ? 'flex min-h-screen items-center justify-center bg-surface px-4'
                    : 'flex min-h-[50vh] items-center justify-center px-4 py-16'
            }
        >
            <div className="max-w-md text-center">
                <p className="type-h2 text-ink">Bir sorun oluştu</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                    Sayfa yüklenirken beklenmeyen bir hata oldu. Tekrar deneyebilir ya da sayfayı yenileyebilirsiniz.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={retry}
                        className="inline-flex h-11 items-center justify-center rounded-card bg-brand-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
                    >
                        Tekrar dene
                    </button>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="inline-flex h-11 items-center justify-center rounded-card border border-line-strong bg-white px-5 text-sm font-semibold text-ink transition-colors hover:border-ink"
                    >
                        Sayfayı yenile
                    </button>
                    <a href="/" className="inline-flex h-11 items-center px-2 text-sm font-semibold text-brand-600 hover:underline">
                        Ana sayfa
                    </a>
                </div>
            </div>
        </div>
    )
}
