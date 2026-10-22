// Unit tests for components/layout/focus-rules.ts (where focus goes when a drawer or a sheet with a focus trap opens
// or closes), and for the assistant sheet stepping aside for the search sheet (yieldAssistantSheet).
// Run: node --test scripts/focus-rules.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { focusRestoreTarget, mustDropFocus, shouldTakeInitialFocus } from '../components/layout/focus-rules.ts'

/** A tiny element tree: parent links, hidden/inert flags and boxes (display: none has none). */
function el(name, { parent = null, hidden = false, inert = false, boxes = 1, connected = true } = {}) {
    const node = {
        name,
        parent,
        hidden,
        inert,
        isConnected: connected,
        getClientRects: () => ({ length: boxes }),
        closest(selector) {
            for (let n = this; n; n = n.parent) {
                if ((selector.includes('[hidden]') && n.hidden) || (selector.includes('[inert]') && n.inert)) return n
            }
            return null
        },
        contains(other) {
            for (let n = other; n; n = n?.parent) if (n === this) return true
            return false
        },
    }
    return node
}

const body = el('body')
const page = el('page', { parent: body })
const searchInput = el('search input', { parent: page })
const launcher = el('assistant launcher', { parent: page })
const sheet = el('assistant sheet', { parent: body })
const waField = el('WhatsApp message field', { parent: sheet })
const composer = el('composer', { parent: sheet })

test('initial focus: taken while focus is still where it was (or nowhere), never from a field the visitor chose outside', () => {
    assert.equal(shouldTakeInitialFocus(sheet, launcher, launcher, body), true)
    assert.equal(shouldTakeInitialFocus(sheet, body, launcher, body), true)
    assert.equal(shouldTakeInitialFocus(sheet, null, null, body), true)
    // Already inside: nothing to do
    assert.equal(shouldTakeInitialFocus(sheet, composer, launcher, body), false)
    // The visitor tapped the search box in the meantime: focus stays there
    assert.equal(shouldTakeInitialFocus(sheet, searchInput, launcher, body), false)
})

test('restore: back to the trigger when focus is still in the closing layer and the trigger is on screen', () => {
    assert.equal(focusRestoreTarget(sheet, launcher, composer, body), launcher)
    assert.equal(focusRestoreTarget(sheet, launcher, body, body), launcher)
    assert.equal(focusRestoreTarget(sheet, launcher, null, body), launcher)
})

test('restore: never away from an element the visitor focused outside the layer (the search box)', () => {
    assert.equal(focusRestoreTarget(sheet, launcher, searchInput, body), null)
})

test('restore: never into the closing layer itself, nor into a hidden, inert, removed or unrendered element', () => {
    // The sheet opened while its own message field still had focus (a hidden sheet kept it on iOS)
    assert.equal(focusRestoreTarget(sheet, waField, body, body), null)
    const hiddenPanel = el('hidden panel', { parent: body, hidden: true })
    assert.equal(focusRestoreTarget(sheet, el('field in hidden panel', { parent: hiddenPanel }), body, body), null)
    const inertPage = el('inert page', { parent: body, inert: true })
    assert.equal(focusRestoreTarget(sheet, el('button under inert', { parent: inertPage }), body, body), null)
    assert.equal(focusRestoreTarget(sheet, el('display none', { parent: page, boxes: 0 }), body, body), null)
    assert.equal(focusRestoreTarget(sheet, el('removed', { parent: page, connected: false }), body, body), null)
    assert.equal(focusRestoreTarget(sheet, body, body, body), null)
    assert.equal(focusRestoreTarget(sheet, null, body, body), null)
})

test('drop: a field that still has focus inside the closing layer is blurred; focus outside is left alone', () => {
    assert.equal(mustDropFocus(sheet, waField, body), true)
    assert.equal(mustDropFocus(sheet, composer, body), true)
    assert.equal(mustDropFocus(sheet, searchInput, body), false)
    assert.equal(mustDropFocus(sheet, body, body), false)
    assert.equal(mustDropFocus(sheet, null, body), false)
})

test('yieldAssistantSheet: the visible phone sheet is minimised for the search sheet; nothing else changes', async () => {
    const { useAssistantStore, yieldAssistantSheet } = await import('../components/assistant/assistant-store.ts')
    const reset = state => useAssistantStore.setState({ open: false, minimized: false, isSheet: false, ...state })

    reset({ open: true, isSheet: true })
    yieldAssistantSheet()
    assert.equal(useAssistantStore.getState().minimized, true)
    assert.equal(useAssistantStore.getState().open, true, 'the conversation stays (only minimised)')

    // Desktop panel (not a sheet): the search dropdown does not cover it
    reset({ open: true, isSheet: false })
    yieldAssistantSheet()
    assert.equal(useAssistantStore.getState().minimized, false)

    // Closed or already minimised: nothing
    reset({ open: false, isSheet: true })
    yieldAssistantSheet()
    assert.deepEqual([useAssistantStore.getState().open, useAssistantStore.getState().minimized], [false, false])
    reset({ open: true, minimized: true, isSheet: true })
    yieldAssistantSheet()
    assert.equal(useAssistantStore.getState().minimized, true)
})
