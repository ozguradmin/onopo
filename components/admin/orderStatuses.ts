import { Check, CheckCircle2, Clock, Package, Truck, X, type LucideIcon } from 'lucide-react'
import { ORDER_STATUSES } from '@/lib/order-status'

/**
 * Order statuses the admin can show and set: the values and labels of lib/order-status.ts ORDER_STATUSES
 * (the list BirFatura reads), in workflow order. PayTR sets 'approved' (paid) and 'cancelled'.
 * The classes are complete strings so Tailwind generates them.
 */
export interface OrderStatusInfo {
    value: string
    label: string
    icon: LucideIcon
    /** Badge in the lists */
    badge: string
    /** Selected button on the order page */
    selected: string
}

const STYLES: Record<string, Omit<OrderStatusInfo, 'value' | 'label'>> = {
    pending: { icon: Clock, badge: 'bg-yellow-100 text-yellow-700', selected: 'border-yellow-500 bg-yellow-50 text-yellow-700' },
    approved: { icon: CheckCircle2, badge: 'bg-emerald-100 text-emerald-700', selected: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
    processing: { icon: Package, badge: 'bg-blue-100 text-blue-700', selected: 'border-blue-500 bg-blue-50 text-blue-700' },
    shipped: { icon: Truck, badge: 'bg-purple-100 text-purple-700', selected: 'border-purple-500 bg-purple-50 text-purple-700' },
    completed: { icon: Check, badge: 'bg-green-100 text-green-700', selected: 'border-green-500 bg-green-50 text-green-700' },
    cancelled: { icon: X, badge: 'bg-red-100 text-red-700', selected: 'border-red-500 bg-red-50 text-red-700' },
}

const UNKNOWN_STYLE: Omit<OrderStatusInfo, 'value' | 'label'> = {
    icon: Clock,
    badge: 'bg-slate-100 text-slate-700',
    selected: 'border-slate-500 bg-slate-50 text-slate-700',
}

const WORKFLOW_ORDER = ['pending', 'approved', 'processing', 'shipped', 'completed', 'cancelled']
const rank = (status: string) => {
    const i = WORKFLOW_ORDER.indexOf(status)
    return i === -1 ? WORKFLOW_ORDER.length : i
}

export const ORDER_STATUS_OPTIONS: OrderStatusInfo[] = [...ORDER_STATUSES]
    .sort((a, b) => rank(a.status) - rank(b.status))
    .map(s => ({ value: s.status, label: s.label, ...(STYLES[s.status] ?? UNKNOWN_STYLE) }))

// Values the old admin could set that BirFatura does not know
const LEGACY_LABELS: Record<string, string> = { delivered: 'Teslim Edildi' }

export function isKnownOrderStatus(status: string | null | undefined): boolean {
    return ORDER_STATUS_OPTIONS.some(s => s.value === status)
}

/** Display info for any stored status; an unknown one (e.g. old 'delivered') keeps its own name, in grey. */
export function orderStatusInfo(status: string | null | undefined): OrderStatusInfo {
    const known = ORDER_STATUS_OPTIONS.find(s => s.value === status)
    if (known) return known
    const value = status || ''
    return { value, label: LEGACY_LABELS[value] || value || 'Bilinmiyor', ...UNKNOWN_STYLE }
}
