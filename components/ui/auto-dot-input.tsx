'use client'

import React, { useState, useEffect } from 'react'

interface AutoDotInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string | number
    onChange: (value: string) => void
}

export function AutoDotInput({ value, onChange, className, ...props }: AutoDotInputProps) {
    const [displayValue, setDisplayValue] = useState('')

    useEffect(() => {
        // Sync external value to display value, formatting adds dots
        // Assuming value is a raw number or string like "1234.56"
        // We want to show "1.234,56" or similar? 
        // User asked: "1699 yazarsak 1.699 olsun". This implies thousands separator while typing.

        if (value === undefined || value === null) {
            setDisplayValue('')
            return
        }

        const valStr = value.toString()
        // Simple logic: if raw value is "1699", display "1.699"
        // We need to strip existing non-digits to re-format.
        const raw = valStr.replace(/\D/g, '') // Keep only digits
        // Format with thousands separator
        // Note: User said "1.699", which looks like Turkish format -> dot as thousands separator.
        const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".")

        setDisplayValue(formatted)
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // User types: "1", "16", "169", "1699" -> becomes "1.699"
        const input = e.target.value

        // Strip everything except digits
        const raw = input.replace(/\D/g, '')

        // We emit the RAW number back to the parent (so form data has "1699")
        // But we render formatted in this component.
        // Parent state should hold the raw value to be sent to API.
        onChange(raw)
    }

    return (
        <input
            {...props}
            type="text" // Must be text to allow formatting chars
            value={displayValue}
            onChange={handleChange}
            className={className}
        />
    )
}
