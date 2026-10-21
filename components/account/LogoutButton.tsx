'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resetFavorites } from '@/components/product/ProductCardActions'

/** POST /api/auth/logout (clears auth_token), forget cached favourites, go home (client navigation). */
export function LogoutButton({ className, label = 'Çıkış yap' }: { className?: string; label?: string }) {
    const router = useRouter()
    const [busy, setBusy] = React.useState(false)

    const onClick = async () => {
        if (busy) return
        setBusy(true)
        try {
            await fetch('/api/auth/logout', { method: 'POST' })
        } catch {
            // the cookie is cleared server-side; on a network error we still leave the account area
        }
        resetFavorites()
        router.replace('/')
        router.refresh()
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={busy}
            aria-busy={busy || undefined}
            className={cn(
                'inline-flex min-h-11 items-center gap-2.5 rounded-card px-3 text-sm font-medium text-muted transition-colors hover:bg-sale-50 hover:text-danger disabled:opacity-60',
                className,
            )}
        >
            <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
            {busy ? 'Çıkış yapılıyor…' : label}
        </button>
    )
}
