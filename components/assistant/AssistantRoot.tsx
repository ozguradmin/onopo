'use client'

/**
 * Onopo Asistan entry (SPEC §10.2), mounted by LayoutProvider on store pages only while the public setting
 * ai_assistant_enabled is on. Shell code: it must stay tiny and must not change the page.
 *
 * - Client only: LayoutProvider loads this module (next/dynamic, ssr: false) in the first idle period after the
 *   page has loaded, so the launcher shows as soon as it has mounted. No request is made, so the server HTML,
 *   h1, JSON-LD, LCP and CLS stay exactly as they are.
 * - Not on checkout, payment results, admin, maintenance, login or register.
 * - The chat panel is a separate chunk (preload.ts loadPanel), mounted the first time the chat opens and
 *   kept mounted afterwards, so a reply keeps streaming while the panel is minimised. Until the chunk has
 *   arrived, a frame with skeleton bars stands in, so the tap feels instant.
 * - A conversation saved in this tab (persist.ts, same key) makes the launcher read "Sohbete devam et"
 *   without loading the chunk.
 */
import * as React from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useHydrated } from '@/components/layout/overlay-hooks'
import { ASSISTANT_EXCLUDED_PATH, useAssistantStore } from './assistant-store'
import { AssistantLauncher } from './AssistantLauncher'
import { loadPanel } from './preload'

/** persist.ts STORAGE_KEY and LIMITS.persistMaxAgeMs (not imported: they would pull the module into the shell) */
const STORAGE_KEY = 'onopo:assistant:v1'
const MAX_AGE_MS = 2 * 60 * 60 * 1000

const AssistantPanel = dynamic(loadPanel, { ssr: false, loading: () => <PanelSkeleton /> })

export function AssistantRoot() {
    const hydrated = useHydrated()
    const path = usePathname() || '/'
    const open = useAssistantStore(s => s.open)
    const minimized = useAssistantStore(s => s.minimized)
    // LayoutProvider already waited for an idle period before loading this module
    const idle = hydrated
    const [panel, setPanel] = React.useState(false)
    const excluded = ASSISTANT_EXCLUDED_PATH.test(path)

    // First open mounts the panel; it then stays mounted (a running reply keeps streaming)
    if (open && !panel) setPanel(true)

    React.useEffect(() => {
        if (!idle) return
        try {
            const raw = sessionStorage.getItem(STORAGE_KEY)
            const saved = raw ? JSON.parse(raw) : null
            if (saved && Date.now() - saved.updatedAt < MAX_AGE_MS && saved.messages?.length > 0) {
                useAssistantStore.setState({ hasConversation: true })
            }
        } catch {
            // no storage: no saved chat
        }
    }, [idle])

    // Leaving for checkout / login: the chat waits minimised (the launcher reads "Sohbete devam et" on return)
    React.useEffect(() => {
        if (excluded && open && !minimized) useAssistantStore.getState().minimize()
    }, [excluded, open, minimized])

    if (!idle || excluded) return null
    return (
        <>
            <AssistantLauncher />
            {panel && <AssistantPanel />}
        </>
    )
}

/** Frame + header + 3 skeleton bars in the panel's geometry, while the chat chunk downloads. */
function PanelSkeleton() {
    return (
        <div
            aria-hidden="true"
            className="fixed inset-x-0 bottom-0 z-assistant flex h-[calc(100dvh-8px)] flex-col rounded-t-sheet bg-white shadow-overlay md:inset-x-auto md:bottom-6 md:right-6 md:h-[min(680px,calc(100dvh-48px))] md:w-[400px] md:rounded-sheet md:border md:border-line 2xl:w-[420px]"
        >
            <div className="flex h-14 items-center gap-3 border-b border-line px-4">
                <div className="skeleton h-8 w-8 rounded-full" />
                <div className="skeleton h-4 w-32 rounded-chip" />
            </div>
            <div className="flex flex-col gap-3 p-4">
                <div className="skeleton h-4 w-4/5 rounded-chip" />
                <div className="skeleton h-4 w-3/5 rounded-chip" />
                <div className="skeleton h-4 w-2/3 rounded-chip" />
            </div>
        </div>
    )
}
