'use client'

/**
 * Bottom sheet on the native <dialog> (showModal): the rest of the page is inert, focus stays inside,
 * Escape and a tap on the backdrop close it, and focus returns to the opener. Page scroll is locked
 * while it is open. Radius 16 top, max 85vh, sticky header and optional sticky footer (spec §10).
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BottomSheetProps {
    open: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    footer?: React.ReactNode
    className?: string
}

export function BottomSheet({ open, onClose, title, children, footer, className }: BottomSheetProps) {
    const ref = React.useRef<HTMLDialogElement>(null)
    const titleId = React.useId()
    // The content is mounted on first open (not in the server HTML) and kept for the close animation
    const [mounted, setMounted] = React.useState(false)
    if (open && !mounted) setMounted(true)
    const SheetTitle = mounted ? 'h2' : 'p'
    const onCloseRef = React.useRef(onClose)
    React.useEffect(() => {
        onCloseRef.current = onClose
    }, [onClose])

    React.useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        if (open && !dialog.open) {
            dialog.showModal()
            const html = document.documentElement
            const prev = html.style.overflow
            html.style.overflow = 'hidden'
            return () => {
                html.style.overflow = prev
            }
        }
        if (!open && dialog.open) dialog.close()
    }, [open])

    // Escape / dialog.close() → tell the parent
    React.useEffect(() => {
        const dialog = ref.current
        if (!dialog) return
        const handle = () => onCloseRef.current()
        dialog.addEventListener('close', handle)
        return () => dialog.removeEventListener('close', handle)
    }, [])

    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            onClick={e => {
                // A click on the dialog box itself (outside the panel) is a click on the backdrop
                if (e.target === e.currentTarget) onClose()
            }}
            className={cn(
                'fixed inset-x-0 bottom-0 top-auto m-0 h-auto max-h-[85dvh] w-full max-w-none overflow-hidden rounded-t-sheet bg-white p-0 text-ink shadow-overlay',
                'translate-y-full transition-[translate,overlay,display] transition-discrete duration-250 ease-sheet open:translate-y-0 starting:open:translate-y-full',
                'backdrop:bg-ink/50 backdrop:backdrop-blur-[1px]',
                className,
            )}
        >
            <div className="flex max-h-[85dvh] flex-col">
                <div className="relative flex shrink-0 items-center justify-between border-b border-line pt-2 pb-1 pl-4 pr-1.5">
                    <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-line-strong" aria-hidden="true" />
                    {/* A heading only once opened: closed sheets are in the server HTML, and "Sırala" /
                        "Filtrele" are UI controls, not sections of the page */}
                    <SheetTitle id={titleId} className="type-h3 pt-1 text-ink">
                        {title}
                    </SheetTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Kapat"
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">{mounted ? children : null}</div>
                {footer && mounted && (
                    <div className="shrink-0 border-t border-line bg-white px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))]">{footer}</div>
                )}
            </div>
        </dialog>
    )
}

export default BottomSheet
