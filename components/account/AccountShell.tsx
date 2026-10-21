import * as React from 'react'
import Link from 'next/link'
import { Heart, LayoutDashboard, Package, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { LogoutButton } from '@/components/account/LogoutButton'
import type { AccountUser } from '@/lib/account'

export type AccountSection = 'profile' | 'orders' | 'favorites'

const NAV: Array<{ key: AccountSection; label: string; href: string; Icon: typeof UserRound }> = [
    { key: 'profile', label: 'Hesabım', href: '/profile/', Icon: UserRound },
    { key: 'orders', label: 'Siparişlerim', href: '/orders/', Icon: Package },
    { key: 'favorites', label: 'Favorilerim', href: '/profile/?tab=favorites', Icon: Heart },
]

export function initialsOf(user: Pick<AccountUser, 'fullName' | 'email'>): string {
    const words = user.fullName.trim().split(/\s+/).filter(Boolean)
    const letters = words.length ? words.slice(0, 2).map(w => w.charAt(0)) : [user.email.charAt(0) || '?']
    return letters.join('').toLocaleUpperCase('tr-TR')
}

export function firstNameOf(user: Pick<AccountUser, 'fullName'>): string {
    return user.fullName.trim().split(/\s+/)[0] || ''
}

/**
 * Frame of the customer account pages: breadcrumb, greeting, section navigation (sidebar on desktop,
 * scrollable pills on mobile) and the page H1. Server component; only the logout button is a client island.
 */
export function AccountShell({
    user,
    active,
    title,
    description,
    children,
}: {
    user: AccountUser
    active: AccountSection
    title: string
    description?: React.ReactNode
    children: React.ReactNode
}) {
    const isAdmin = user.role === 'admin'
    const firstName = firstNameOf(user)

    return (
        <div className="min-h-[60vh] bg-surface pb-14 pt-4 lg:pb-20 lg:pt-6">
            <div className="container-store">
                <Breadcrumb
                    items={[
                        { label: 'Anasayfa', href: '/' },
                        ...(active === 'profile' ? [{ label: 'Hesabım' }] : [{ label: 'Hesabım', href: '/profile/' }, { label: title }]),
                    ]}
                />

                <div className="mt-4 lg:mt-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-8">
                    {/* Sidebar (desktop) / greeting + pills (mobile) */}
                    <aside className="lg:sticky lg:top-[88px] lg:col-span-3">
                        <div className="flex items-center gap-3 lg:rounded-sheet lg:border lg:border-line lg:bg-white lg:p-5 lg:shadow-card">
                            <span
                                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-bold text-brand-700"
                                aria-hidden="true"
                            >
                                {initialsOf(user)}
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-[15px] font-semibold text-ink">{firstName ? `Merhaba, ${firstName}` : 'Merhaba'}</p>
                                <p className="truncate text-[13px] text-muted">{user.email}</p>
                            </div>
                        </div>

                        <nav aria-label="Hesap menüsü" className="mt-4 lg:mt-3 lg:rounded-sheet lg:border lg:border-line lg:bg-white lg:p-2 lg:shadow-card">
                            <ul className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
                                {NAV.map(({ key, label, href, Icon }) => {
                                    const current = key === active
                                    return (
                                        <li key={key} className="shrink-0">
                                            <Link
                                                href={href}
                                                aria-current={current ? 'page' : undefined}
                                                className={cn(
                                                    'inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors',
                                                    'lg:flex lg:w-full lg:rounded-card lg:border-0 lg:px-3',
                                                    current
                                                        ? 'border-ink bg-ink text-white lg:bg-brand-50 lg:text-brand-700'
                                                        : 'border-line bg-white text-ink-2 hover:border-line-strong lg:hover:bg-surface',
                                                )}
                                            >
                                                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                                {label}
                                            </Link>
                                        </li>
                                    )
                                })}
                                {isAdmin && (
                                    <li className="shrink-0">
                                        <Link
                                            href="/admin/"
                                            prefetch={false}
                                            className="inline-flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-white px-4 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong lg:flex lg:w-full lg:rounded-card lg:border-0 lg:px-3 lg:hover:bg-surface"
                                        >
                                            <LayoutDashboard className="h-[18px] w-[18px]" aria-hidden="true" />
                                            Yönetim paneli
                                        </Link>
                                    </li>
                                )}
                                <li className="hidden lg:mt-1 lg:block lg:border-t lg:border-line lg:pt-1">
                                    <LogoutButton className="w-full" />
                                </li>
                            </ul>
                        </nav>
                    </aside>

                    <div className="mt-6 min-w-0 lg:col-span-9 lg:mt-0">
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 lg:mb-5">
                            <div className="min-w-0">
                                <h1 className="type-h1 text-ink">{title}</h1>
                                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
                            </div>
                        </div>
                        {children}
                        <div className="mt-8 border-t border-line pt-4 lg:hidden">
                            <LogoutButton className="-ml-3" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
