'use client'

/**
 * "Barkod (GTIN/EAN)" field of the admin product forms. Validates as the admin types (lib/gtin.ts: 8, 12, 13
 * or 14 digits with a valid GS1 check digit; empty is allowed). The product APIs check it again on save.
 */
import * as React from 'react'
import { gtinError } from '@/lib/gtin'

export function GtinField({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
    const id = React.useId()
    const [touched, setTouched] = React.useState(false)
    const problem = gtinError(value)
    const show = Boolean(problem) && (touched || value.replace(/\D/g, '').length >= 8)
    return (
        <div className={className}>
            <label htmlFor={id} className="block text-sm font-medium mb-1">Barkod (GTIN/EAN)</label>
            <input
                id={id}
                name="gtin"
                inputMode="numeric"
                autoComplete="off"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="Örn: 8680000000000"
                aria-invalid={show || undefined}
                aria-describedby={`${id}-help`}
                className={`w-full p-2 border rounded-lg ${show ? 'border-red-400' : ''}`}
            />
            <p id={`${id}-help`} className={`mt-1 text-xs ${show ? 'text-red-600' : 'text-slate-500'}`}>
                {show ? problem : 'Ürün kutusundaki barkod. Google Alışveriş ve Akakçe eşleştirmesi için; yoksa boş bırakın.'}
            </p>
        </div>
    )
}

export default GtinField
