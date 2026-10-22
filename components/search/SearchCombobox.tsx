'use client'

/**
 * Instant search (spec §7, owner bug #1): an ARIA combobox over the compact catalogue index.
 *
 * - Typing only updates local state. Nothing navigates while the user types, so no character is ever
 *   lost and the page never reloads. Results are computed with lib/search (Turkish folding, ranking)
 *   on every keystroke from the in-memory index (loaded once on the first focus).
 * - Enter / "Tüm sonuçları gör" → /products/?q=… with router.push (client navigation). Without
 *   JavaScript the <form> still submits GET /products/?q=….
 * - Keyboard: ↑/↓ move through the options, Enter opens the active one, Escape closes (a second
 *   Escape clears the text). Focus stays in the input (aria-activedescendant).
 * - variant "desktop": dropdown under the field. variant "mobile": the field lives in the header's
 *   second row; focusing it turns its container into a full-screen sheet (the same input element
 *   keeps focus, so the iOS keyboard stays open) with a "Vazgeç" button.
 * - Onopo Asistan (only while ai_assistant_enabled is on): with 0–2 results the first row is "Asistana sor:
 *   “…”", which opens the chat with the query as the first message (the chat chunk preloads on pointerdown).
 */
import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowRight, ChevronRight, History, MessageCircle, RotateCcw, Search, SearchX, Sparkles, TrendingUp, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { matchesSearch, prepareQuery, searchItems, splitDisplayName, type PreparedQuery } from '@/lib/search'
import { displayPrice, formatTL } from '@/lib/format'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { productPath } from '@/lib/seo'
import { FallbackImage } from '@/components/ui/FallbackImage'
import { useStoreData } from '@/components/layout/store-data'
import { registerMobileSearch, useShellUI } from '@/components/layout/shell-ui'
import { useEscape, useFocusTrap, useScrollLock } from '@/components/layout/overlay-hooks'
import { CategoryIcon } from '@/components/layout/CategoryIcon'
import { CONNECTOR_LINKS, POPULAR_SEARCHES, PRODUCT_TYPE_LINKS, whatsappHref } from '@/components/layout/nav-data'
import { useSearchIndex, type SearchIndexItem } from './search-index'
import { addRecentSearch, clearRecentSearches, useRecentSearches } from './recent-searches'
import { Highlight } from './Highlight'
import { ASSISTANT_EXCLUDED_PATH, useAssistantStore } from '@/components/assistant/assistant-store'
import { preloadAssistant } from '@/components/assistant/preload'

type Option =
    | { kind: 'product'; href: string; item: SearchIndexItem }
    | { kind: 'link'; href: string; label: string; meta: string; icon?: string; nofollow?: boolean }
    | { kind: 'all'; href: string; count: number }
    | { kind: 'query'; query: string; source: 'recent' | 'popular' }
    | { kind: 'clear' }
    | { kind: 'assistant'; query: string }

const MAX_PRODUCTS = 6
const MAX_LINKS = 4

export interface SearchComboboxProps {
    variant: 'desktop' | 'mobile'
    /** Called synchronously on focus, before the dropdown / sheet opens (the header un-hides itself). */
    onBeforeOpen?: () => void
    className?: string
}

function searchHref(q: string) {
    return `/products/?q=${encodeURIComponent(q.trim())}`
}

export function SearchCombobox({ variant, onBeforeOpen, className }: SearchComboboxProps) {
    const router = useRouter()
    const pathname = usePathname()
    const { categories, settings } = useStoreData()
    const index = useSearchIndex()
    const loadIndex = index.load
    const recent = useRecentSearches()
    const sheetOpen = useShellUI(s => s.searchOpen)
    const setSheetOpen = useShellUI(s => s.setSearchOpen)
    const isMobile = variant === 'mobile'
    // Typed by the settings change of the assistant's API package; read defensively until then
    const assistantOn = (settings as typeof settings & { ai_assistant_enabled?: boolean }).ai_assistant_enabled === true
        && !ASSISTANT_EXCLUDED_PATH.test(pathname || '/')

    const [value, setValue] = React.useState('')
    const [focused, setFocused] = React.useState(false)
    const [dismissed, setDismissed] = React.useState(false)
    const [active, setActive] = React.useState(-1)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const sheetRef = React.useRef<HTMLDivElement>(null)
    const uid = React.useId()
    const listId = `${uid}-list`
    const optionId = (i: number) => `${uid}-o${i}`

    const open = isMobile ? sheetOpen : focused && !dismissed

    // ---- data -------------------------------------------------------------------------------------
    const deferred = React.useDeferredValue(value)
    const query: PreparedQuery = React.useMemo(() => prepareQuery(deferred), [deferred])
    const hasQuery = query.tokens.length > 0
    const items = index.items
    const matches = React.useMemo(
        () => (hasQuery && items ? searchItems(items, query) : []),
        [items, query, hasQuery],
    )
    const linkMatches = React.useMemo(() => {
        if (!hasQuery) return []
        const out: Extract<Option, { kind: 'link' }>[] = []
        for (const c of categories) {
            if (matchesSearch({ name: c.name, slug: c.slug }, query)) {
                out.push({ kind: 'link', href: c.href, label: c.name, meta: `${c.product_count} ürün`, icon: c.icon })
            }
        }
        for (const t of [...PRODUCT_TYPE_LINKS, ...CONNECTOR_LINKS]) {
            if (matchesSearch({ name: t.label, slug: t.key }, query)) {
                out.push({ kind: 'link', href: t.href, label: t.label, meta: 'Ürün tipi', nofollow: true })
            }
        }
        return out.slice(0, MAX_LINKS)
    }, [categories, query, hasQuery])

    const popular = React.useMemo(
        () => (items ? POPULAR_SEARCHES.filter(p => searchItems(items, p, { limit: 1 }).length > 0) : POPULAR_SEARCHES),
        [items],
    )

    const options: Option[] = React.useMemo(() => {
        if (!hasQuery) {
            const list: Option[] = []
            if (recent.length > 0) {
                list.push({ kind: 'clear' })
                recent.forEach(q => list.push({ kind: 'query', query: q, source: 'recent' }))
            }
            popular.forEach(q => list.push({ kind: 'query', query: q, source: 'popular' }))
            PRODUCT_TYPE_LINKS.forEach(t => list.push({ kind: 'link', href: t.href, label: t.short, meta: 'Ürün tipi', nofollow: true }))
            return list
        }
        const list: Option[] = []
        // Few or no results: offer the assistant first
        if (assistantOn && index.status === 'ready' && matches.length <= 2) list.push({ kind: 'assistant', query: deferred.trim() })
        matches.slice(0, MAX_PRODUCTS).forEach(item => list.push({ kind: 'product', href: productPath(item.slug), item }))
        linkMatches.forEach(l => list.push(l))
        if (matches.length > 0 || index.status !== 'ready') {
            list.push({ kind: 'all', href: searchHref(deferred), count: matches.length })
        } else if (linkMatches.length === 0) {
            // No result: offer the popular searches instead
            popular.forEach(q => list.push({ kind: 'query', query: q, source: 'popular' }))
        }
        return list
    }, [hasQuery, recent, popular, matches, linkMatches, index.status, deferred, assistantOn])

    // Reset the highlighted option whenever the result list changes
    React.useEffect(() => {
        setActive(-1)
    }, [deferred, hasQuery])

    React.useEffect(() => {
        if (active < 0) return
        document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active])

    // ---- open / close -----------------------------------------------------------------------------
    const close = React.useCallback(
        (blur = false) => {
            if (isMobile) setSheetOpen(false)
            else setDismissed(true)
            setActive(-1)
            if (blur || isMobile) inputRef.current?.blur()
        },
        [isMobile, setSheetOpen],
    )

    // Route changed (a result or a link was opened): close, and show the current ?q= in the box
    React.useEffect(() => {
        if (isMobile) setSheetOpen(false)
        setDismissed(true)
        if (pathname && /^\/products\/?$/.test(pathname)) {
            try {
                const q = new URLSearchParams(window.location.search).get('q')
                if (q && document.activeElement !== inputRef.current) setValue(q)
            } catch {
                // ignore
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname])

    // Mobile sheet: register the opener for the bottom-nav "Ara" button; lock the page behind it
    React.useEffect(() => {
        if (!isMobile) return
        return registerMobileSearch(() => {
            onBeforeOpen?.()
            inputRef.current?.focus()
            setSheetOpen(true)
            loadIndex()
        })
    }, [isMobile, onBeforeOpen, setSheetOpen, loadIndex])
    useScrollLock(isMobile && sheetOpen)
    // No focus restore: focus is already in the input when the sheet opens
    useFocusTrap(sheetRef, isMobile && sheetOpen, undefined, { restore: false })
    useEscape(isMobile && sheetOpen, () => close(true))

    // The sheet was closed from outside (navigation): drop the focus so the next tap opens it again
    React.useEffect(() => {
        if (isMobile && !sheetOpen && document.activeElement === inputRef.current) inputRef.current?.blur()
    }, [isMobile, sheetOpen])

    const onFocus = () => {
        loadIndex()
        setFocused(true)
        setDismissed(false)
        if (!isMobile) onBeforeOpen?.()
        else if (!sheetOpen) {
            onBeforeOpen?.()
            setSheetOpen(true)
        }
    }

    // ---- actions ----------------------------------------------------------------------------------
    const submit = (raw: string) => {
        const q = raw.trim()
        if (!q) {
            inputRef.current?.focus()
            return
        }
        addRecentSearch(q)
        close(true)
        router.push(searchHref(q))
    }

    const activate = (opt: Option) => {
        switch (opt.kind) {
            case 'product':
                if (value.trim()) addRecentSearch(value)
                close(true)
                router.push(opt.href)
                break
            case 'link':
                close(true)
                router.push(opt.href)
                break
            case 'all':
                submit(value)
                break
            case 'query':
                setValue(opt.query)
                inputRef.current?.focus()
                break
            case 'clear':
                clearRecentSearches()
                inputRef.current?.focus()
                break
            case 'assistant':
                close(true)
                useAssistantStore.getState().openAssistant({ source: 'search', prompt: opt.query })
                break
        }
    }

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.nativeEvent.isComposing) return
        const n = options.length
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault()
                if (!open) {
                    setDismissed(false)
                    if (isMobile) setSheetOpen(true)
                    return
                }
                if (n > 0) setActive(a => (a + 1) % n)
                break
            case 'ArrowUp':
                e.preventDefault()
                if (n > 0) setActive(a => (a <= 0 ? n - 1 : a - 1))
                break
            case 'Enter':
                if (open && active >= 0 && active < n) {
                    e.preventDefault()
                    activate(options[active])
                }
                // otherwise the form submits → submit(value)
                break
            case 'Escape':
                if (open) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (isMobile) close(true)
                    else {
                        setDismissed(true)
                        setActive(-1)
                    }
                } else if (value) {
                    e.preventDefault()
                    setValue('')
                }
                break
        }
    }

    // Link options navigate natively (client-side via next/link); close the popup on the way out
    const onOptionClick = (opt: Option) => (e: React.MouseEvent) => {
        if (opt.kind === 'product' || opt.kind === 'link') {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
            if (opt.kind === 'product' && value.trim()) addRecentSearch(value)
            close(true)
            return
        }
        e.preventDefault()
        activate(opt)
    }

    // ---- status line for screen readers -----------------------------------------------------------
    let status = ''
    if (open && hasQuery) {
        if (index.status === 'ready') status = matches.length > 0 ? `${matches.length} ürün bulundu` : 'Sonuç bulunamadı'
        else if (index.status === 'loading') status = 'Aranıyor'
    }

    const activeId = open && active >= 0 && active < options.length ? optionId(active) : undefined
    const placeholder = isMobile ? 'Ürün, model veya cihaz ara' : 'Ürün, model veya cihaz ara (ör. "iPhone 20W")'

    const field = (
        <form
            role="search"
            action="/products/"
            method="get"
            onSubmit={e => {
                e.preventDefault()
                submit(value)
            }}
            className={cn('relative flex min-w-0 flex-1 items-center')}
        >
            <label htmlFor={`${uid}-input`} className="sr-only">
                Ürün ara
            </label>
            <Search className="pointer-events-none absolute left-3.5 h-5 w-5 text-muted" aria-hidden="true" strokeWidth={2} />
            <input
                ref={inputRef}
                id={`${uid}-input`}
                name="q"
                type="search"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-haspopup="listbox"
                aria-activedescendant={activeId}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                maxLength={120}
                placeholder={placeholder}
                value={value}
                onChange={e => {
                    setValue(e.target.value)
                    setDismissed(false)
                    setActive(-1)
                }}
                onFocus={onFocus}
                onBlur={() => {
                    if (!isMobile) setFocused(false)
                }}
                onKeyDown={onKeyDown}
                onPointerEnter={loadIndex}
                onClick={() => {
                    if (!isMobile && dismissed) setDismissed(false)
                }}
                className={cn(
                    'h-11 w-full min-w-0 appearance-none rounded-card border border-transparent bg-field pl-11 pr-11 text-ink outline-none',
                    isMobile ? 'text-base' : 'text-[15px]',
                    'transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-subtle',
                    'focus:border-brand-600 focus:bg-white focus:shadow-focus focus-visible:shadow-focus',
                    '[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden',
                )}
            />
            {value && (
                <button
                    type="button"
                    aria-label="Aramayı temizle"
                    onMouseDown={e => e.preventDefault()}
                    onClick={() => {
                        setValue('')
                        setDismissed(false)
                        inputRef.current?.focus()
                    }}
                    className="absolute right-0 inline-flex h-11 w-11 items-center justify-center rounded-card text-muted transition-colors hover:text-ink"
                >
                    <X className="h-[18px] w-[18px]" aria-hidden="true" />
                </button>
            )}
        </form>
    )

    const popup = (
        <SearchPopup
            listId={listId}
            optionId={optionId}
            options={options}
            active={active}
            setActive={setActive}
            onOptionClick={onOptionClick}
            hasQuery={hasQuery}
            rawQuery={deferred.trim()}
            tokens={query.tokens}
            status={index.status}
            matchesCount={matches.length}
            onRetry={loadIndex}
            whatsapp={whatsappHref(settings.whatsapp_number, deferred ? `Merhaba, "${deferred.trim()}" ürününü arıyorum.` : undefined)}
            variant={variant}
        />
    )

    if (isMobile) {
        return (
            <div className={cn('relative h-full', className)}>
                <div
                    ref={sheetRef}
                    role={sheetOpen ? 'dialog' : undefined}
                    aria-modal={sheetOpen ? true : undefined}
                    aria-label={sheetOpen ? 'Ürün ara' : undefined}
                    className={cn(sheetOpen ? 'fixed inset-0 z-drawer flex flex-col bg-white' : 'flex h-full items-center')}
                >
                    <div className={cn('flex w-full items-center gap-2', sheetOpen && 'border-b border-line px-4 pb-2.5 pt-[max(10px,env(safe-area-inset-top))]')}>
                        {field}
                        {sheetOpen && (
                            <button
                                type="button"
                                onClick={() => close(true)}
                                className="-mr-1 inline-flex h-11 shrink-0 items-center rounded-thumb px-2 text-[15px] font-semibold text-brand-600 hover:text-brand-700"
                            >
                                Vazgeç
                            </button>
                        )}
                    </div>
                    {sheetOpen && (
                        <div
                            className="flex-1 overflow-y-auto overscroll-contain px-2 pb-[max(16px,env(safe-area-inset-bottom))] pt-2"
                            onMouseDown={e => e.preventDefault()}
                        >
                            {popup}
                        </div>
                    )}
                    <p className="sr-only" role="status" aria-live="polite">
                        {status}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className={cn('relative w-full', className)}>
            {field}
            {open && (
                <>
                    <div
                        aria-hidden="true"
                        className="fixed inset-0 -z-10 bg-ink/25"
                        onMouseDown={() => {
                            setDismissed(true)
                        }}
                    />
                    <div
                        className="absolute inset-x-0 top-[calc(100%+8px)] max-h-[min(70vh,640px)] overflow-y-auto overscroll-contain rounded-sheet border border-line bg-white p-2 shadow-overlay"
                        onMouseDown={e => e.preventDefault()}
                    >
                        {popup}
                    </div>
                </>
            )}
            <p className="sr-only" role="status" aria-live="polite">
                {status}
            </p>
        </div>
    )
}

// ---------------------------------------------------------------------------------------------
// Popup content (shared by the dropdown and the mobile sheet)
// ---------------------------------------------------------------------------------------------

interface SearchPopupProps {
    listId: string
    optionId: (i: number) => string
    options: Option[]
    active: number
    setActive: (i: number) => void
    onOptionClick: (opt: Option) => (e: React.MouseEvent) => void
    hasQuery: boolean
    rawQuery: string
    tokens: string[]
    status: 'idle' | 'loading' | 'ready' | 'error'
    matchesCount: number
    onRetry: () => void
    whatsapp: string | null
    variant: 'desktop' | 'mobile'
}

function SearchPopup(props: SearchPopupProps) {
    const { listId, optionId, options, active, setActive, onOptionClick, hasQuery, rawQuery, tokens, status, matchesCount, onRetry, whatsapp } = props

    // Options grouped for rendering, keeping their global index for aria-activedescendant
    const indexed = options.map((opt, i) => ({ opt, i }))
    const products = indexed.filter(x => x.opt.kind === 'product')
    const recentOpts = indexed.filter(x => x.opt.kind === 'query' && x.opt.source === 'recent')
    const popularOpts = indexed.filter(x => x.opt.kind === 'query' && x.opt.source === 'popular')
    const clearOpt = indexed.find(x => x.opt.kind === 'clear')
    const links = indexed.filter(x => x.opt.kind === 'link')
    const all = indexed.find(x => x.opt.kind === 'all')
    const assistant = indexed.find(x => x.opt.kind === 'assistant')

    const common = (i: number, opt: Option) => ({
        id: optionId(i),
        role: 'option' as const,
        'aria-selected': active === i,
        tabIndex: -1,
        onMouseMove: () => active !== i && setActive(i),
        onClick: onOptionClick(opt),
    })

    const noResults = hasQuery && status === 'ready' && matchesCount === 0 && links.length === 0
    const loading = hasQuery && (status === 'loading' || status === 'idle')

    return (
        <div id={listId} role="listbox" aria-label="Arama önerileri" className="flex flex-col gap-1">
            {/* ---------- empty query: recent + popular + product types ---------- */}
            {!hasQuery && recentOpts.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-recent`} className="pb-1">
                    <div className="flex items-center justify-between px-2 pb-1 pt-1.5">
                        <span id={`${listId}-recent`} className="type-micro text-muted">
                            Son aramalar
                        </span>
                        {clearOpt && (
                            <span
                                {...common(clearOpt.i, clearOpt.opt)}
                                className="cursor-pointer rounded-chip px-2 py-1 text-[13px] font-semibold text-brand-600 hover:text-brand-700 aria-selected:bg-brand-50"
                            >
                                Temizle
                            </span>
                        )}
                    </div>
                    {recentOpts.map(({ opt, i }) => (
                        <div
                            key={`r-${i}`}
                            {...common(i, opt)}
                            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-thumb px-2 text-[15px] text-ink-2 aria-selected:bg-surface"
                        >
                            <History className="h-[18px] w-[18px] shrink-0 text-subtle" aria-hidden="true" />
                            <span className="truncate">{opt.kind === 'query' ? opt.query : ''}</span>
                        </div>
                    ))}
                </div>
            )}

            {popularOpts.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-popular`} className={cn('pb-2', hasQuery && 'order-last')}>
                    <div id={`${listId}-popular`} className="type-micro px-2 pb-2 pt-1.5 text-muted">
                        Popüler aramalar
                    </div>
                    <div className="flex flex-wrap gap-2 px-2">
                        {popularOpts.map(({ opt, i }) => (
                            <span
                                key={`p-${i}`}
                                {...common(i, opt)}
                                className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong aria-selected:border-brand-600 aria-selected:bg-brand-50 aria-selected:text-brand-700"
                            >
                                <TrendingUp className="h-4 w-4 text-brand-500" aria-hidden="true" />
                                {opt.kind === 'query' ? opt.query : ''}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {!hasQuery && links.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-types`} className="border-t border-line pt-2">
                    <div id={`${listId}-types`} className="type-micro px-2 pb-1 pt-1 text-muted">
                        Ürün tipine göre
                    </div>
                    <div className="grid grid-cols-2 gap-0.5">
                        {links.map(({ opt, i }) =>
                            opt.kind === 'link' ? (
                                <Link
                                    key={`t-${i}`}
                                    href={opt.href}
                                    prefetch={false}
                                    rel="nofollow"
                                    {...common(i, opt)}
                                    className="flex min-h-11 items-center gap-2 rounded-thumb px-2 text-sm font-medium text-ink-2 aria-selected:bg-surface"
                                >
                                    <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                                    <span className="truncate">{opt.label}</span>
                                </Link>
                            ) : null,
                        )}
                    </div>
                </div>
            )}

            {/* ---------- with a query ---------- */}
            {hasQuery && assistant && assistant.opt.kind === 'assistant' && (
                <div
                    {...common(assistant.i, assistant.opt)}
                    onPointerDown={preloadAssistant}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-card px-2 py-1 aria-selected:bg-surface"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-hidden="true">
                        <Sparkles className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">Asistana sor: “{assistant.opt.query}”</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
                </div>
            )}

            {loading && products.length === 0 && (
                <div aria-hidden="true" className="flex flex-col gap-1 p-1">
                    {[0, 1, 2].map(k => (
                        <div key={k} className="flex items-center gap-3 px-1 py-1.5">
                            <div className="skeleton h-12 w-12 shrink-0 rounded-thumb" />
                            <div className="flex flex-1 flex-col gap-2">
                                <div className="skeleton h-3.5 w-4/5 rounded-chip" />
                                <div className="skeleton h-3.5 w-20 rounded-chip" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {hasQuery && status === 'error' && (
                <div className="flex flex-col items-start gap-2 px-3 py-3 text-sm text-muted">
                    <p>Anlık sonuçlar şu an yüklenemedi. Aramak için Enter tuşuna basabilirsiniz.</p>
                    <button
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={onRetry}
                        className="inline-flex h-9 items-center gap-1.5 rounded-thumb border border-line px-3 text-[13px] font-semibold text-ink hover:border-line-strong"
                    >
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        Tekrar dene
                    </button>
                </div>
            )}

            {hasQuery && products.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-products`}>
                    <div id={`${listId}-products`} className="type-micro px-2 pb-1 pt-1.5 text-muted">
                        Ürünler
                    </div>
                    {products.map(({ opt, i }) => {
                        if (opt.kind !== 'product') return null
                        const p = opt.item
                        const price = displayPrice(p.price)
                        const old = p.original_price ? displayPrice(p.original_price) : 0
                        const soldOut = p.stock <= 0
                        // Same title as the product cards: a generic "… uyumlu" lead goes to its own line
                        const name = splitDisplayName(p.name)
                        return (
                            <Link
                                key={p.id}
                                href={opt.href}
                                prefetch={false}
                                title={p.name}
                                {...common(i, opt)}
                                className="group flex items-center gap-3 rounded-card px-2 py-1.5 aria-selected:bg-surface"
                            >
                                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-thumb border border-line bg-white p-1">
                                    <FallbackImage
                                        src={productImageUrl(p.image, 200)}
                                        fallbackSrc={originalImageUrl(p.image)}
                                        alt=""
                                        width={40}
                                        height={40}
                                        loading="lazy"
                                        className={cn('h-full w-full object-contain', soldOut && 'opacity-50')}
                                    />
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="line-clamp-2 text-sm leading-5 text-ink-2">
                                        <Highlight text={name.title} tokens={tokens} />
                                    </span>
                                    {name.compat && (
                                        <span className="truncate text-xs leading-4 text-muted">
                                            <Highlight text={name.compat} tokens={tokens} />
                                        </span>
                                    )}
                                    <span className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                                        <span className="text-sm font-bold text-ink">{formatTL(price)}</span>
                                        {old > price && <del className="text-xs text-muted">{formatTL(old)}</del>}
                                        {soldOut && <span className="text-xs font-semibold text-sale">Tükendi</span>}
                                    </span>
                                </span>
                                <ChevronRight className="h-4 w-4 shrink-0 text-subtle opacity-0 transition-opacity group-aria-selected:opacity-100" aria-hidden="true" />
                            </Link>
                        )
                    })}
                </div>
            )}

            {hasQuery && links.length > 0 && (
                <div role="group" aria-labelledby={`${listId}-links`} className={cn(products.length > 0 && 'mt-1 border-t border-line pt-1')}>
                    <div id={`${listId}-links`} className="type-micro px-2 pb-1 pt-1.5 text-muted">
                        İlgili kategoriler
                    </div>
                    {links.map(({ opt, i }) =>
                        opt.kind === 'link' ? (
                            <Link
                                key={`l-${i}`}
                                href={opt.href}
                                prefetch={false}
                                rel={opt.nofollow ? 'nofollow' : undefined}
                                {...common(i, opt)}
                                className="flex min-h-11 items-center gap-3 rounded-card px-2 py-1 aria-selected:bg-surface"
                            >
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                                    {opt.icon ? <CategoryIcon name={opt.icon} className="h-[18px] w-[18px]" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                                    <Highlight text={opt.label} tokens={tokens} />
                                </span>
                                <span className="shrink-0 text-xs text-muted">{opt.meta}</span>
                            </Link>
                        ) : null,
                    )}
                </div>
            )}

            {hasQuery && all && all.opt.kind === 'all' && (
                <Link
                    href={all.opt.href}
                    prefetch={false}
                    {...common(all.i, all.opt)}
                    className={cn(
                        'mt-1 flex min-h-12 items-center justify-between gap-3 rounded-card bg-surface px-3 text-sm font-semibold text-brand-600 hover:text-brand-700 aria-selected:bg-brand-50',
                        // Sticky in the dropdown's scroller, pinned over its 8px bottom padding (-bottom-2) so no row shows
                        // (or takes clicks) under the bar on 768px-tall screens; the white underlay (2nd shadow) fills
                        // the rounded corners and the padding beside the bar.
                        props.variant === 'desktop' && 'sticky -bottom-2 shadow-[0_-8px_16px_-8px_rgb(11_18_32/0.12),0_8px_0_8px_#fff]',
                    )}
                >
                    <span className="min-w-0 truncate">
                        «{rawQuery}» için tüm sonuçları gör{status === 'ready' ? ` (${all.opt.count})` : ''}
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />
                </Link>
            )}

            {noResults && (
                <div className="flex flex-col items-center px-4 py-6 text-center">
                    <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted" aria-hidden="true">
                        <SearchX className="h-6 w-6" />
                    </span>
                    <p className="text-[15px] font-semibold text-ink">«{rawQuery}» için sonuç bulunamadı</p>
                    <p className="mt-1 text-sm text-muted">Yazımı kontrol edin ya da daha genel bir kelime deneyin (ör. “kablo”, “şarj”).</p>
                    {whatsapp && (
                        <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            onMouseDown={e => e.preventDefault()}
                            className="mt-4 inline-flex h-10 items-center gap-2 rounded-card border border-line-strong px-4 text-sm font-semibold text-whatsapp hover:border-whatsapp"
                        >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                            WhatsApp&apos;tan sorun
                        </a>
                    )}
                </div>
            )}
        </div>
    )
}
