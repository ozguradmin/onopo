import * as React from 'react'
import { AlertCircle, CheckCircle2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Form primitives for the storefront forms (checkout, login, register, account) — design spec §13:
 * 48px controls, radius 10, 1px line-strong border, brand-600 border + focus shadow on focus,
 * labels above the field at 13/600 ink-2, required marker in sale red, errors 13px danger with an
 * icon under the field (wired with aria-describedby / aria-invalid). Server-friendly (no hooks).
 */

const CONTROL_BASE =
    'block w-full rounded-[10px] border border-line-strong bg-white px-3.5 text-[15px] leading-6 text-ink ' +
    'placeholder:text-subtle transition-[border-color,box-shadow] duration-150 ease-out hover:border-muted ' +
    'focus:border-brand-600 focus:shadow-focus focus:outline-none ' +
    'aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgb(180_35_24/.18)] ' +
    'disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted'

/** Single-line input / select: 48px tall. */
export const inputClass = cn(CONTROL_BASE, 'h-12')

/** Multi-line input: same look, at least 3 lines. */
export const textareaClass = cn(CONTROL_BASE, 'min-h-[88px] resize-none py-3')

/** Native checkbox in brand colour, 20px. */
export const checkboxClass =
    'h-5 w-5 shrink-0 cursor-pointer rounded-[5px] border-line-strong accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600'

export interface FieldProps {
    /** id of the control (the label's htmlFor). */
    id: string
    label: React.ReactNode
    /** Shows the red asterisk (the control itself still needs `required`). */
    required?: boolean
    /** Shows "(isteğe bağlı)" after the label. */
    optional?: boolean
    hint?: React.ReactNode
    error?: React.ReactNode
    /** Exactly one input/textarea/select element; id, aria-describedby and aria-invalid are added. */
    children: React.ReactElement<React.InputHTMLAttributes<HTMLElement>>
    className?: string
    /** Extra element on the label row (e.g. "Şifremi unuttum"). */
    labelAside?: React.ReactNode
}

export function Field({ id, label, required, optional, hint, error, children, className, labelAside }: FieldProps) {
    const hintId = hint && !error ? `${id}-hint` : undefined // the hint is not rendered while an error replaces it
    const errorId = error ? `${id}-error` : undefined
    const describedBy = [children.props['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined
    const control = React.cloneElement(children, {
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : children.props['aria-invalid'],
    })

    return (
        <div className={cn('flex min-w-0 flex-col', className)}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <label htmlFor={id} className="text-[13px] font-semibold leading-5 text-ink-2">
                    {label}
                    {required && (
                        <span className="ml-0.5 text-sale" aria-hidden="true">
                            *
                        </span>
                    )}
                    {optional && <span className="ml-1 font-normal text-muted">(isteğe bağlı)</span>}
                </label>
                {labelAside}
            </div>
            {control}
            {hint && !error && (
                <p id={hintId} className="mt-1.5 text-[13px] leading-5 text-muted">
                    {hint}
                </p>
            )}
            {error && (
                <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-5 text-danger">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{error}</span>
                </p>
            )}
        </div>
    )
}

const ALERT_TONES = {
    error: { box: 'border-sale/25 bg-sale-50 text-danger', Icon: AlertCircle },
    success: { box: 'border-success/25 bg-success-50 text-success', Icon: CheckCircle2 },
    info: { box: 'border-brand-100 bg-brand-50 text-brand-700', Icon: Info },
} as const

/**
 * Message box above/below a form. Errors use role="alert" so screen readers announce them;
 * success/info use role="status".
 */
export function FormAlert({
    tone = 'error',
    children,
    className,
    id,
}: {
    tone?: keyof typeof ALERT_TONES
    children: React.ReactNode
    className?: string
    id?: string
}) {
    const { box, Icon } = ALERT_TONES[tone]
    return (
        <div
            id={id}
            role={tone === 'error' ? 'alert' : 'status'}
            className={cn('flex items-start gap-2.5 rounded-card border px-3.5 py-3 text-sm font-medium leading-5', box, className)}
        >
            <Icon className="mt-px h-[18px] w-[18px] shrink-0" aria-hidden="true" />
            <div className="min-w-0">{children}</div>
        </div>
    )
}
