'use client'

/**
 * Side drawer used by the cart and the mobile menu (spec §7, §12, §17).
 * - role="dialog" + aria-modal, labelled by the caller's title id
 * - focus trap, Escape and overlay click close it, focus returns to the trigger
 * - body scroll lock while open
 * - CSS transitions only (250 ms, ease-sheet); `inert` while closed so nothing inside is focusable
 * - the content is rendered only after the first open (keeps the server HTML small)
 */
import * as React from 'react'
import { cn } from '@/lib/utils'
import { useEscape, useFocusTrap, useScrollLock } from '@/components/layout/overlay-hooks'

export interface DrawerProps {
    open: boolean
    onClose: () => void
    side: 'left' | 'right'
    /** id of the visible title element inside the drawer */
    labelledBy: string
    /** element to focus when the drawer opens (default: the panel) */
    initialFocus?: React.RefObject<HTMLElement | null>
    className?: string
    children: React.ReactNode
}

export function Drawer({ open, onClose, side, labelledBy, initialFocus, className, children }: DrawerProps) {
    const panelRef = React.useRef<HTMLDivElement>(null)
    const [rendered, setRendered] = React.useState(open)
    if (open && !rendered) setRendered(true)

    useScrollLock(open)
    useFocusTrap(panelRef, open, initialFocus)
    useEscape(open, onClose)

    return (
        <div
            className={cn(
                'fixed inset-0 z-drawer',
                // visible at once when opening (so focus can move in); hidden only after the slide-out
                open ? 'visible' : 'pointer-events-none invisible transition-[visibility] delay-250 duration-0',
            )}
            inert={!open}
        >
            <div
                aria-hidden="true"
                onClick={onClose}
                className={cn(
                    'absolute inset-0 bg-ink/50 transition-opacity duration-250 ease-sheet',
                    open ? 'opacity-100' : 'opacity-0',
                )}
            />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={labelledBy}
                tabIndex={-1}
                className={cn(
                    'absolute inset-y-0 flex flex-col bg-white shadow-overlay outline-none transition-transform duration-250 ease-sheet will-change-transform',
                    side === 'right' ? 'right-0' : 'left-0',
                    open ? 'translate-x-0' : side === 'right' ? 'translate-x-full' : '-translate-x-full',
                    className,
                )}
            >
                {rendered ? children : null}
            </div>
        </div>
    )
}
