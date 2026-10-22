// Unit tests for components/layout/page-awake.ts (when the campaign slider and the top bar start moving).
// Run: node --test scripts/page-awake.test.mjs   (Node 23.6+ strips the TypeScript types itself)
import test from 'node:test'
import assert from 'node:assert/strict'
import { AUTOSTART_DELAY_MS, INTERACTION_EVENTS, onPageAwake } from '../components/layout/page-awake.ts'

/** A fake window + document: event targets, a state that the test changes, timers from node:test's mock clock. */
function fakeEnv({ readyState = 'complete', visibilityState = 'visible' } = {}) {
    const win = new EventTarget()
    const doc = new EventTarget()
    doc.readyState = readyState
    doc.visibilityState = visibilityState
    win.setTimeout = (fn, ms) => setTimeout(fn, ms)
    win.clearTimeout = id => clearTimeout(id)
    return { win, doc }
}

test('page-awake: starts 6 s after a loaded, visible page, once, without any interaction', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const env = fakeEnv()
    let calls = 0
    onPageAwake(() => calls++, AUTOSTART_DELAY_MS, env)
    t.mock.timers.tick(AUTOSTART_DELAY_MS - 1)
    assert.equal(calls, 0)
    t.mock.timers.tick(1)
    assert.equal(calls, 1)
    // Later interactions do nothing more
    env.win.dispatchEvent(new Event('pointerdown'))
    t.mock.timers.tick(AUTOSTART_DELAY_MS * 2)
    assert.equal(calls, 1)
})

test('page-awake: the first interaction starts it at once and stops the timer', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    for (const type of INTERACTION_EVENTS) {
        const env = fakeEnv()
        let calls = 0
        onPageAwake(() => calls++, AUTOSTART_DELAY_MS, env)
        t.mock.timers.tick(1000)
        env.win.dispatchEvent(new Event(type))
        assert.equal(calls, 1, type)
        t.mock.timers.tick(AUTOSTART_DELAY_MS)
        env.win.dispatchEvent(new Event(type))
        assert.equal(calls, 1, type)
    }
})

test('page-awake: the countdown waits for the load event', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const env = fakeEnv({ readyState: 'interactive' })
    let calls = 0
    onPageAwake(() => calls++, AUTOSTART_DELAY_MS, env)
    t.mock.timers.tick(AUTOSTART_DELAY_MS * 3)
    assert.equal(calls, 0)
    env.doc.readyState = 'complete'
    env.win.dispatchEvent(new Event('load'))
    t.mock.timers.tick(AUTOSTART_DELAY_MS - 1)
    assert.equal(calls, 0)
    t.mock.timers.tick(1)
    assert.equal(calls, 1)
})

test('page-awake: a hidden tab does not count; the countdown starts again when it is shown', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const env = fakeEnv({ visibilityState: 'hidden' })
    let calls = 0
    onPageAwake(() => calls++, AUTOSTART_DELAY_MS, env)
    t.mock.timers.tick(AUTOSTART_DELAY_MS * 2)
    assert.equal(calls, 0)
    env.doc.visibilityState = 'visible'
    env.doc.dispatchEvent(new Event('visibilitychange'))
    t.mock.timers.tick(4000)
    // Hidden again before the 6 s: nothing, and a full countdown after it comes back
    env.doc.visibilityState = 'hidden'
    env.doc.dispatchEvent(new Event('visibilitychange'))
    t.mock.timers.tick(AUTOSTART_DELAY_MS)
    assert.equal(calls, 0)
    env.doc.visibilityState = 'visible'
    env.doc.dispatchEvent(new Event('visibilitychange'))
    t.mock.timers.tick(AUTOSTART_DELAY_MS - 1)
    assert.equal(calls, 0)
    t.mock.timers.tick(1)
    assert.equal(calls, 1)
})

test('page-awake: the cleanup removes the timer and the listeners without calling back', t => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const env = fakeEnv()
    let calls = 0
    const stop = onPageAwake(() => calls++, AUTOSTART_DELAY_MS, env)
    stop()
    env.win.dispatchEvent(new Event('scroll'))
    t.mock.timers.tick(AUTOSTART_DELAY_MS * 2)
    assert.equal(calls, 0)
})

test('page-awake: no window (server render) is a no-op', () => {
    const stop = onPageAwake(() => assert.fail('must not run'), AUTOSTART_DELAY_MS, null)
    assert.equal(typeof stop, 'function')
    stop()
})
