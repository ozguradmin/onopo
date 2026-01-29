'use client'

import * as React from 'react'
import { cn } from "@/lib/utils"

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value?: string | number
    onChange: (value: string) => void
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
    const [displayValue, setDisplayValue] = React.useState('')

    // Initialize display value from prop
    React.useEffect(() => {
        if (value === undefined || value === '' || value === null) {
            setDisplayValue('')
            return
        }

        const valStr = value.toString()
        // If incoming value is already nicely formatted (has comma), keep it
        // Or if it's a raw number "1234.56", format it to "1.234,56"
        if (valStr.includes(',') && valStr.includes('.')) {
            // likely already formatted or mixed, let's re-format strictly
            // But careful, user might be typing
        }

        // Parse raw number to formatted string
        // 1234.56 -> 1.234,56
        const parts = valStr.split('.')
        let integerPart = parts[0]
        const decimalPart = parts[1] || ''

        // Add dots to integer part
        integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

        let formatted = integerPart
        if (parts.length > 1) {
            formatted += ',' + decimalPart
        }

        setDisplayValue(formatted)
    }, [value]) // NOTE: This might cause cursor jumps if we aren't careful, but simpler for now.

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let input = e.target.value

        // Allow digits and comma only
        // Remove everything else (keep comma and dots locally for parsing, but strictly we want to control it)

        // 1. Remove all non-digit and non-comma characters (except dots which might be user typed?)
        // User said: "nokta koymasam bile... ben virgül tuşuna basarsam virgül çıksın"
        // So user inputs commas for decimals.

        // Let's filter input: valid chars are 0-9 and ,
        // We will ignore dots typed by user often, but since we add them automatically, we should allow them in input but strip them for processing

        // Detect if user typed a comma
        const hasComma = input.includes(',')

        // Split by comma
        const parts = input.split(',')

        // Process integer part (before comma)
        let integerPart = parts[0].replace(/\D/g, '') // remove all non-digits (dots/spaces)

        // Format integer part with dots
        if (integerPart) {
            integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        }

        // Process decimal part (after comma)
        let decimalPart = ''
        if (parts.length > 1) {
            // Take the part after the first comma
            // If there are multiple commas, effectively we drop subsequent ones or merge? 
            // Simple approach: take parts[1] and strip non-digits
            decimalPart = parts[1].replace(/\D/g, '').substring(0, 2) // Max 2 decimals usually? User said 171,72
        }

        // Construct display value
        let newDisplay = integerPart
        if (hasComma) {
            newDisplay += ',' + decimalPart
        }

        // Update local state immediately for smooth typing
        setDisplayValue(newDisplay)

        // Calculate raw numeric value for parent
        // "1.234,56" -> 1234.56
        const rawInteger = integerPart.replace(/\./g, '')
        let rawValue = rawInteger
        if (hasComma && decimalPart) {
            rawValue += '.' + decimalPart
        }

        // Call parent onChange with the numeric string equivalent
        onChange(rawValue)
    }

    return (
        <input
            {...props}
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={handleChange}
            style={{ paddingLeft: '3rem' }}
            className={cn(
                "flex h-10 w-full rounded-md border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
        />
    )
}
