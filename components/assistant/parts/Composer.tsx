'use client'

/**
 * Message box (SPEC §10.5): a 16 px textarea (no iOS zoom) that grows to 4 lines, Enter sends and
 * Shift+Enter adds a line, a counter from 400 characters (limit 500), and a send button that turns into
 * "Durdur" while a reply streams. No footer line under it any more (w7): the AI notice lives in the empty
 * chat's line and the ⋯ menu, so the composer stays clean.
 */
import * as React from 'react'
import { ArrowUp, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LIMITS } from '@/lib/assistant/contract'

export interface ComposerProps {
    value: string
    onChange: (value: string) => void
    onSend: () => void
    onStop: () => void
    streaming: boolean
    disabled: boolean
    textareaRef: React.RefObject<HTMLTextAreaElement | null>
}

/** field-sizing: content where supported; elsewhere the height follows the content here. */
function autosize(el: HTMLTextAreaElement | null) {
    if (!el || (typeof CSS !== 'undefined' && CSS.supports?.('field-sizing', 'content'))) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
}

export function Composer({ value, onChange, onSend, onStop, streaming, disabled, textareaRef }: ComposerProps) {
    const canSend = !disabled && !streaming && value.trim().length > 0

    React.useLayoutEffect(() => autosize(textareaRef.current), [value, textareaRef])

    return (
        <div className="border-t border-line/70 bg-white px-3 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">
            <form
                className="flex items-end gap-2"
                onSubmit={e => {
                    e.preventDefault()
                    if (canSend) onSend()
                }}
            >
                <label htmlFor="assistant-input" className="sr-only">Mesajın</label>
                <textarea
                    ref={textareaRef}
                    id="assistant-input"
                    rows={1}
                    value={value}
                    maxLength={LIMITS.inputMaxChars}
                    enterKeyHint="send"
                    autoComplete="off"
                    placeholder="Ne arıyorsun? Örn. iPhone 15 için hızlı şarj"
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                            e.preventDefault()
                            if (canSend) onSend()
                        }
                    }}
                    className="max-h-32 min-h-11 w-full resize-none rounded-card bg-field px-3.5 py-2.5 text-base leading-6 text-ink outline-none [field-sizing:content] placeholder:text-muted focus:shadow-focus"
                />
                {streaming ? (
                    <button
                        type="button"
                        onClick={onStop}
                        aria-label="Yanıtı durdur"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-ink text-white hover:bg-ink-2"
                    >
                        <Square aria-hidden="true" className="h-4 w-4" fill="currentColor" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={!canSend}
                        aria-label="Gönder"
                        className={cn(
                            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors',
                            canSend ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-line text-muted',
                        )}
                    >
                        <ArrowUp aria-hidden="true" className="h-5 w-5" strokeWidth={2.5} />
                    </button>
                )}
            </form>
            {value.length >= 400 && (
                <p className="mt-1 text-right text-[11px] tabular-nums text-muted" aria-live="polite">
                    {value.length}/{LIMITS.inputMaxChars}
                </p>
            )}
        </div>
    )
}
