'use client'

/**
 * In-page search for the listings (fixes "search accepts 1-2 letters, then reloads").
 *
 * - Controlled input that is never remounted or overwritten while the visitor types: results follow
 *   through a debounced (300 ms) client-side URL update (router.replace, no reload, focus stays).
 * - Enter submits at once (and closes the keyboard on touch screens); the clear button resets the query
 *   and keeps focus in the field.
 * - When the query changes from outside (header search, "clear" chip, back button), the field follows.
 */
import * as React from 'react'
import { Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useListing } from './ListingProvider'

const DEBOUNCE_MS = 300

export function ListingSearchBox({ placeholder = 'Ürünlerde ara', label = 'Ürünlerde ara', className }: { placeholder?: string; label?: string; className?: string }) {
    const { committed, update, pending } = useListing()
    const [value, setValue] = React.useState(committed.q)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const composing = React.useRef(false)
    /** The last query this box sent to the URL (so a late server answer never overwrites newer typing). */
    const lastSent = React.useRef(committed.q)
    const inputId = React.useId()

    React.useEffect(() => {
        if (committed.q !== lastSent.current) {
            lastSent.current = committed.q
            setValue(committed.q)
        }
    }, [committed.q])

    React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

    const send = React.useCallback(
        (raw: string) => {
            if (timer.current) {
                clearTimeout(timer.current)
                timer.current = null
            }
            const q = raw.replace(/\s+/g, ' ').trim().slice(0, 120)
            if (q === lastSent.current.trim()) return
            lastSent.current = q
            update({ q }, { kind: 'search' })
        },
        [update],
    )

    const schedule = (next: string) => {
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => {
            timer.current = null
            if (!composing.current) send(next)
        }, DEBOUNCE_MS)
    }

    const onSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        send(value)
        // On touch screens close the keyboard so the results are visible
        if (window.matchMedia?.('(pointer: coarse)').matches) inputRef.current?.blur()
    }

    const clear = () => {
        setValue('')
        send('')
        inputRef.current?.focus()
    }

    const busy = pending === 'search'

    return (
        // Named so it differs from the header's search landmark
        <form role="search" aria-label="Ürünlerde ara" onSubmit={onSubmit} className={cn('relative', className)} action="" noValidate>
            <label htmlFor={inputId} className="sr-only">
                {label}
            </label>
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
            </span>
            <input
                ref={inputRef}
                id={inputId}
                type="search"
                name="q"
                value={value}
                onChange={e => {
                    setValue(e.target.value)
                    schedule(e.target.value)
                }}
                onCompositionStart={() => { composing.current = true }}
                onCompositionEnd={e => {
                    composing.current = false
                    schedule((e.target as HTMLInputElement).value)
                }}
                placeholder={placeholder}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={120}
                className={cn(
                    'h-11 w-full appearance-none rounded-card border border-line-strong bg-white pl-11 pr-12 lg:h-12 text-[15px] text-ink placeholder:text-subtle',
                    'transition-[border-color,box-shadow] duration-150 focus:border-brand-600 focus:shadow-focus focus:outline-none',
                    '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
                )}
            />
            {value && (
                <button
                    type="button"
                    onClick={clear}
                    aria-label="Aramayı temizle"
                    className="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
                >
                    <X className="h-5 w-5" aria-hidden="true" />
                </button>
            )}
        </form>
    )
}

export default ListingSearchBox
