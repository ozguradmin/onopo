'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { inputClass } from '@/components/forms/Field'

/**
 * Password input with a show/hide toggle (44px hit area). Pass it as the child of <Field>, which adds
 * id / aria-describedby / aria-invalid; they are forwarded to the <input>.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>>(
    function PasswordInput({ className, ...props }, ref) {
        const [visible, setVisible] = React.useState(false)
        return (
            <div className="relative">
                <input ref={ref} type={visible ? 'text' : 'password'} className={cn(inputClass, 'pr-12', className)} {...props} />
                <button
                    type="button"
                    onClick={() => setVisible(v => !v)}
                    aria-label={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
                    aria-pressed={visible}
                    className="absolute right-0.5 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-[9px] text-muted transition-colors hover:text-ink"
                >
                    {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
                </button>
            </div>
        )
    },
)
