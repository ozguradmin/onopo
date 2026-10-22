/**
 * Onopo Asistan: the one place that names the lazy chat chunk (shell). AssistantRoot loads it through
 * next/dynamic on the first open; every entry point calls preloadAssistant() on pointerdown / hover / focus,
 * which on a phone starts the download about 100 ms before the click, so the panel usually opens without
 * showing its skeleton. Nothing here runs before a visitor reaches for the assistant.
 */
export const loadPanel = () => import('./AssistantPanel')

let started = false

export function preloadAssistant(): void {
    if (started) return
    started = true
    loadPanel().catch(() => {
        started = false // offline or a failed chunk: try again on the next gesture
    })
}
