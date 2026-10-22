'use client'

/**
 * Onopo Asistan: the small shared state of the chat (shell, part of every store page's JS, so it stays
 * tiny). The launcher, the search box's "Asistana sor" row, the bottom nav and the lazy panel all read it;
 * the conversation itself lives in the panel chunk (useAssistantChat.ts), not here.
 *
 *   open / minimized   the panel is shown while open && !minimized. Phones minimise (× / swipe / backdrop),
 *                      desktop closes; both keep the conversation, only "Yeni sohbet" clears it.
 *   unread             a reply finished while the panel was hidden (the launcher's dot)
 *   hasConversation    a conversation exists in this tab ("Sohbete devam et")
 *   pendingPrompt      a first message handed over by an entry point (search, PDP chips); the panel sends it
 *   isSheet            the panel is the phone sheet (< 768 px): the bottom nav slides away under it
 *   device             the phone model pill, sent with every request
 *   openCount          bumped on every open, so the panel can send one 'open' beacon with `source`
 */
import { create } from 'zustand'
import type { ChipAction } from '@/lib/assistant/contract'

export type AssistantSource = 'launcher' | 'nudge' | 'search' | 'header' | 'chip' | 'card'

export interface PendingPrompt {
    input: string
    chip?: ChipAction
}

interface AssistantState {
    open: boolean
    minimized: boolean
    unread: boolean
    hasConversation: boolean
    pendingPrompt: PendingPrompt | null
    source: AssistantSource
    isSheet: boolean
    device: string | null
    openCount: number
    openAssistant: (opts?: { source?: AssistantSource; prompt?: string; chip?: ChipAction }) => void
    minimize: () => void
    close: () => void
    markRead: () => void
}

export const useAssistantStore = create<AssistantState>()(set => ({
    open: false,
    minimized: false,
    unread: false,
    hasConversation: false,
    pendingPrompt: null,
    source: 'launcher',
    isSheet: false,
    device: null,
    openCount: 0,
    openAssistant: ({ source = 'launcher', prompt, chip } = {}) =>
        set(s => ({
            open: true,
            minimized: false,
            unread: false,
            source,
            openCount: s.openCount + 1,
            pendingPrompt: prompt && prompt.trim() ? { input: prompt.trim(), ...(chip ? { chip } : {}) } : s.pendingPrompt,
        })),
    minimize: () => set({ minimized: true }),
    close: () => set({ open: false, minimized: false }),
    markRead: () => set({ unread: false }),
}))

/**
 * Paths without the assistant: checkout, payment results, admin, maintenance, login and register. Shared
 * by AssistantRoot and the search box's "Asistana sor" row (no panel can open there).
 */
export const ASSISTANT_EXCLUDED_PATH = /^\/(odeme|siparis-|admin|maintenance|login|register)/

/** The panel is on screen (not closed, not minimised). */
export function assistantVisible(s: Pick<AssistantState, 'open' | 'minimized'>): boolean {
    return s.open && !s.minimized
}

/**
 * The phone sheet makes way for the search sheet (shell search box, bottom-nav "Ara"): it is minimised (the
 * conversation stays, the launcher reads "Sohbete devam et"). Call it after the search field took focus in the
 * same tap, so the sheet's focus trap leaves that focus alone (overlay-hooks / focus-rules.ts).
 */
export function yieldAssistantSheet(): void {
    const s = useAssistantStore.getState()
    if (s.isSheet && assistantVisible(s)) s.minimize()
}
