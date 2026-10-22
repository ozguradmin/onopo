/**
 * Onopo Asistan: the conversation in the visitor's own sessionStorage (SPEC §9.7, §10.8). Pure: the
 * storage is passed in, so node --test can run it against a fake (or one that throws).
 *
 * Why sessionStorage and these limits: no chat text is stored anywhere on our side (KVKK option A), so the
 * tab is the only place a conversation survives a page load. It is kept for 2 hours at most, holds at most
 * 30 finished messages, and never a streaming message or a running step. Any storage error (private mode,
 * quota, blocked storage) or a damaged value simply means "no saved chat".
 */
import { LIMITS } from '@/lib/assistant/contract'
import type { UiMessage } from './chat-reducer'

/** Also read by AssistantRoot (shell) to label the launcher "Sohbete devam et"; keep the two in sync. */
export const STORAGE_KEY = 'onopo:assistant:v1'

export interface StorageLike {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

export interface PersistedChat {
    v: 1
    conversationId: string
    device: string | null
    updatedAt: number
    messages: UiMessage[]
}

const CONVERSATION_ID = /^[A-Za-z0-9-]{8,64}$/

/** What is worth keeping: finished messages only, done steps only, the last 30. */
export function toPersisted(messages: UiMessage[]): UiMessage[] {
    return messages
        .filter(m => m.status === 'done' || m.status === 'stopped' || m.status === 'error')
        .map(m => (m.steps.some(s => s.state !== 'done') ? { ...m, steps: m.steps.filter(s => s.state === 'done') } : m))
        .slice(-LIMITS.persistMaxMessages)
}

export function saveChat(
    storage: StorageLike | null,
    chat: { conversationId: string; device: string | null; messages: UiMessage[] },
    now = Date.now(),
): boolean {
    if (!storage) return false
    try {
        const value: PersistedChat = {
            v: 1,
            conversationId: chat.conversationId,
            device: chat.device,
            updatedAt: now,
            messages: toPersisted(chat.messages),
        }
        storage.setItem(STORAGE_KEY, JSON.stringify(value))
        return true
    } catch {
        return false
    }
}

function validMessage(m: unknown): m is UiMessage {
    if (!m || typeof m !== 'object') return false
    const x = m as Partial<UiMessage>
    return typeof x.id === 'string'
        && (x.role === 'user' || x.role === 'assistant')
        && typeof x.text === 'string'
        && (x.status === 'done' || x.status === 'stopped' || x.status === 'error')
}

/** A cart receipt worth showing again: a known state and the arrays "Geri al" needs. */
function validReceipt(r: unknown): boolean {
    if (!r || typeof r !== 'object') return false
    const x = r as Record<string, unknown>
    return typeof x.note === 'string'
        && (x.state === 'applied' || x.state === 'none' || x.state === 'undone')
        && Array.isArray(x.touched)
        && Array.isArray(x.before)
}

/** Rebuilds the arrays a damaged or older value may lack, so the UI can map over them safely. */
function normalize(m: UiMessage): UiMessage {
    const receipts = Array.isArray(m.receipts) ? m.receipts.filter(validReceipt) : []
    return {
        ...m,
        createdAt: typeof m.createdAt === 'number' ? m.createdAt : 0,
        steps: Array.isArray(m.steps) ? m.steps.filter(s => s && s.state === 'done') : [],
        cards: Array.isArray(m.cards) ? m.cards : [],
        whatsapp: m.whatsapp && typeof m.whatsapp === 'object' ? m.whatsapp : null,
        suggestions: Array.isArray(m.suggestions) ? m.suggestions : [],
        error: m.error && typeof m.error === 'object' ? m.error : null,
        productIds: Array.isArray(m.productIds) ? m.productIds : [],
        wa: !!m.wa,
        receipts: receipts.length > 0 ? receipts : undefined,
    }
}

/** The saved chat, or null: none, older than 2 hours, damaged, or storage unavailable. */
export function loadChat(storage: StorageLike | null, now = Date.now()): PersistedChat | null {
    if (!storage) return null
    try {
        const raw = storage.getItem(STORAGE_KEY)
        if (!raw) return null
        const data = JSON.parse(raw) as Partial<PersistedChat> | null
        const fresh = data != null
            && data.v === 1
            && typeof data.conversationId === 'string'
            && CONVERSATION_ID.test(data.conversationId)
            && typeof data.updatedAt === 'number'
            && now - data.updatedAt <= LIMITS.persistMaxAgeMs
            && Array.isArray(data.messages)
        if (!fresh) {
            clearChat(storage)
            return null
        }
        return {
            v: 1,
            conversationId: data.conversationId!,
            device: typeof data.device === 'string' && data.device ? data.device.slice(0, 40) : null,
            updatedAt: data.updatedAt!,
            messages: data.messages!.filter(validMessage).map(normalize).slice(-LIMITS.persistMaxMessages),
        }
    } catch {
        return null
    }
}

export function clearChat(storage: StorageLike | null): void {
    try {
        storage?.removeItem(STORAGE_KEY)
    } catch {
        // storage blocked: nothing was saved either
    }
}
