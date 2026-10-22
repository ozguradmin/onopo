/**
 * Onopo Asistan: the numbers behind dragging the phone sheet down to close it (owner complaint: only the
 * grey handle moved and the sheet then vanished at once). Pure, so node --test checks the thresholds;
 * useSheetDrag.ts moves the sheet with them.
 *
 * The sheet follows the finger 1:1 downwards and resists upwards (rubber band, at most RUBBER_MAX_PX). On
 * release it closes when it was pulled past CLOSE_FRACTION of its height, or flicked down fast enough;
 * otherwise it springs back.
 */

/** Movement before a press becomes a drag (a smaller one is a tap, or a scroll that is not ours). */
export const DRAG_START_PX = 6
/** Pulled past this part of the sheet's height: close on release. */
export const CLOSE_FRACTION = 0.3
/** A downward flick at least this fast (px/ms) closes it too, once it moved FLICK_MIN_PX. */
export const FLICK_VELOCITY = 0.5
export const FLICK_MIN_PX = 24
/** Upward pull ends at about this many pixels. */
export const RUBBER_MAX_PX = 28
/** Release velocity is measured over the last part of the gesture. */
export const VELOCITY_WINDOW_MS = 100

/** Sheet offset for a finger moved `dy` px (down positive): 1:1 down, a soft limited stretch up. */
export function dragOffset(dy: number): number {
    if (!Number.isFinite(dy) || dy >= 0) return Number.isFinite(dy) ? dy : 0
    return -RUBBER_MAX_PX * (1 - Math.exp(dy / (RUBBER_MAX_PX * 2)))
}

/**
 * Whether a press that moved (dx, dy) is a drag of the sheet. null: not decided yet (too small).
 * `downOnly` (the transcript, at its top): only a downward pull counts; a pull up is the list's scroll.
 */
export function dragIntent(dx: number, dy: number, downOnly = false): 'drag' | 'other' | null {
    if (Math.abs(dx) < DRAG_START_PX && Math.abs(dy) < DRAG_START_PX) return null
    if (Math.abs(dy) <= Math.abs(dx)) return 'other'
    if (downOnly && dy < 0) return 'other'
    return 'drag'
}

export interface DragSample { y: number; t: number }

/** Downward speed in px/ms over the last VELOCITY_WINDOW_MS of samples (oldest first); 0 with too few. */
export function releaseVelocity(samples: readonly DragSample[], windowMs = VELOCITY_WINDOW_MS): number {
    if (samples.length < 2) return 0
    const last = samples[samples.length - 1]
    let first = samples[samples.length - 2]
    for (let i = samples.length - 2; i >= 0; i--) {
        if (last.t - samples[i].t > windowMs) break
        first = samples[i]
    }
    const dt = last.t - first.t
    return dt > 0 ? (last.y - first.y) / dt : 0
}

/** On release: close, or spring back. */
export function shouldClose({ dy, height, velocity }: { dy: number; height: number; velocity: number }): boolean {
    if (!(dy > 0)) return false
    if (height > 0 && dy >= height * CLOSE_FRACTION) return true
    return velocity >= FLICK_VELOCITY && dy >= FLICK_MIN_PX
}

/** Backdrop opacity (0..1) while the sheet is `offset` px down. */
export function backdropOpacity(offset: number, height: number): number {
    if (!(height > 0) || offset <= 0) return 1
    return Math.max(0, Math.min(1, 1 - offset / height))
}
