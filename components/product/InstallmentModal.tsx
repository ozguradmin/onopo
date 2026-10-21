'use client'

/**
 * PayTR installment table ("Taksit seçenekleri") for the product page.
 *
 * Data flow (unchanged): GET /api/admin/payment-settings (public subset: provider, is_active,
 * merchant_id, taksit_token) → taksit_token, or GET /api/installment-token when it is empty; then
 * PayTR's own table script (www.paytr.com/odeme/taksit-tablosu/v2) renders into #paytr_taksit_tablosu.
 * The token pair is kept for the page's lifetime, so reopening the dialog costs no request.
 *
 * Shell: accessible modal (role=dialog, Escape, focus trap, scroll lock, focus restore), bottom sheet
 * on phones, centred panel from md. No framer-motion.
 */
import * as React from 'react'
import { X } from 'lucide-react'
import { formatTL } from '@/lib/format'
import { useDialog } from '@/components/pdp/useDialog'

interface InstallmentModalProps {
    isOpen: boolean
    onClose: () => void
    /** Unit price the table is computed for (the amount checkout charges). */
    productPrice: number
}

type TokenState = { status: 'idle' | 'loading' } | { status: 'ready'; token: string; merchantId: string } | { status: 'missing' }

let cachedToken: TokenState = { status: 'idle' }

async function loadToken(): Promise<TokenState> {
    if (cachedToken.status === 'ready' || cachedToken.status === 'missing') return cachedToken
    try {
        const res = await fetch('/api/admin/payment-settings', { credentials: 'same-origin' })
        if (res.ok) {
            const data = (await res.json()) as { merchant_id?: string; taksit_token?: string }
            if (data.merchant_id) {
                let token = data.taksit_token || ''
                if (!token) {
                    const tokenRes = await fetch('/api/installment-token')
                    if (tokenRes.ok) token = ((await tokenRes.json()) as { token?: string }).token || ''
                }
                cachedToken = token ? { status: 'ready', token, merchantId: String(data.merchant_id) } : { status: 'missing' }
                return cachedToken
            }
        }
        cachedToken = { status: 'missing' }
    } catch (err) {
        console.error('Failed to fetch payment settings:', err)
        return { status: 'missing' } // not cached: a network error may be temporary
    }
    return cachedToken
}

const PAYTR_TABLE_CSS = `
#paytr_taksit_tablosu{clear:both;font-size:12px;max-width:100%;text-align:center;font-family:inherit;}
#paytr_taksit_tablosu::before{display:table;content:" ";}
#paytr_taksit_tablosu::after{content:"";clear:both;display:table;}
.taksit-tablosu-wrapper{margin:6px;width:280px;padding:12px;cursor:default;text-align:center;display:inline-block;border:1px solid #E6E9EE;border-radius:12px;background:#fff;}
.taksit-logo img{max-height:28px;padding-bottom:10px;}
.taksit-tutari-text{float:left;width:126px;color:#5B6573;margin-bottom:5px;}
.taksit-tutar-wrapper{display:inline-block;background-color:#F6F7F9;border-radius:6px;}
.taksit-tutar-wrapper:hover{background-color:#EEF1F4;}
.taksit-tutari{float:left;width:126px;padding:6px 0;color:#0B1220;border:2px solid #ffffff;}
.taksit-tutari-bold{font-weight:bold;}
@media all and (max-width:600px){.taksit-tablosu-wrapper{margin:6px 0;width:100%;}}
`

export default function InstallmentModal({ isOpen, onClose, productPrice }: InstallmentModalProps) {
    const [state, setState] = React.useState<TokenState>(cachedToken)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const panelRef = useDialog(isOpen, onClose)
    const titleId = React.useId()

    React.useEffect(() => {
        if (!isOpen) return
        let alive = true
        if (cachedToken.status !== 'ready') setState({ status: 'loading' })
        loadToken().then(s => {
            if (alive) setState(s)
        })
        return () => {
            alive = false
        }
    }, [isOpen])

    React.useEffect(() => {
        const container = containerRef.current
        if (!isOpen || state.status !== 'ready' || !container) return
        container.innerHTML = ''
        const style = document.createElement('style')
        style.textContent = PAYTR_TABLE_CSS
        container.appendChild(style)
        const div = document.createElement('div')
        div.id = 'paytr_taksit_tablosu'
        container.appendChild(div)
        // PayTR accepts "1881.38"
        const amount = productPrice.toFixed(2)
        const script = document.createElement('script')
        script.src = `https://www.paytr.com/odeme/taksit-tablosu/v2?token=${state.token}&merchant_id=${state.merchantId}&amount=${amount}&taksit=0&tumu=0`
        script.async = true
        container.appendChild(script)
        return () => {
            container.innerHTML = ''
        }
    }, [isOpen, state, productPrice])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 md:items-center md:p-6" onClick={onClose}>
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                onClick={e => e.stopPropagation()}
                className="flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-sheet bg-white shadow-overlay outline-none md:max-w-3xl md:rounded-sheet"
            >
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line py-2 pl-5 pr-2">
                    <div className="min-w-0">
                        <h2 id={titleId} className="type-h3 text-ink">Taksit seçenekleri</h2>
                        <p className="text-[13px] leading-5 text-muted">{formatTL(productPrice)} için kredi kartı taksit tutarları</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        data-autofocus
                        aria-label="Kapat"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink hover:bg-surface-2"
                    >
                        <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
                    {state.status === 'ready' ? (
                        <div ref={containerRef} className="min-h-[200px]" />
                    ) : state.status === 'missing' ? (
                        <div className="py-10 text-center">
                            <p className="font-semibold text-ink">Taksit tablosu şu an gösterilemiyor.</p>
                            <p className="mt-1 text-sm text-muted">Ödeme adımında kartına uygun taksit seçeneklerini görebilirsin.</p>
                        </div>
                    ) : (
                        <div role="status" className="grid gap-3 sm:grid-cols-2">
                            <span className="sr-only">Taksit seçenekleri hazırlanıyor</span>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i} className="skeleton h-40 rounded-card" aria-hidden="true" />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
