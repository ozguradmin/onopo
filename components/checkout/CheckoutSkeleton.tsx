import * as React from 'react'
import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Minimum height of the short checkout views (this skeleton, the empty cart): the viewport minus the
 * checkout header (h-14 / lg:h-[72px] + 1px border). The footer then starts at the bottom of the
 * screen in both views, so it never jumps when the skeleton is replaced, and tall screens show no
 * white band under the footer. svh: stable while mobile toolbars collapse.
 */
export const CHECKOUT_MIN_HEIGHT = 'min-h-[calc(100svh-57px)] lg:min-h-[calc(100svh-73px)]'

/**
 * Placeholder with the geometry of the checkout (/odeme/): page title, mobile summary bar, form cards
 * on the left, summary card on the right. Used by app/odeme/loading.tsx and while the saved cart loads.
 */
export function CheckoutSkeleton() {
    return (
        <div className={`${CHECKOUT_MIN_HEIGHT} bg-surface pb-16 pt-5 lg:pt-8`} role="status" aria-label="Ödeme sayfası yükleniyor">
            <div className="container-store">
                <div>
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="mt-4 h-7 w-40 lg:h-9" />
                    <div className="mt-5 lg:mt-7 lg:grid lg:grid-cols-12 lg:gap-8">
                        <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
                            <Skeleton className="h-14 w-full rounded-card lg:hidden" />
                            <div className="hidden rounded-sheet border border-line bg-white p-6 lg:block">
                                <Skeleton className="h-5 w-32" />
                                {[0, 1].map(i => (
                                    <div key={i} className="mt-5 flex gap-3">
                                        <Skeleton className="h-16 w-16 shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    </div>
                                ))}
                                <Skeleton className="mt-6 h-4 w-full" />
                                <Skeleton className="mt-3 h-4 w-full" />
                                <Skeleton className="mt-5 h-6 w-full" />
                            </div>
                        </div>
                        <div className="mt-4 space-y-4 lg:col-span-7 lg:row-start-1 lg:mt-0">
                            {[5, 3, 2].map((rows, i) => (
                                <div key={i} className="rounded-sheet border border-line bg-white p-4 sm:p-6">
                                    <Skeleton className="h-6 w-48" />
                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        {Array.from({ length: rows }, (_, j) => (
                                            <div key={j} className="space-y-2">
                                                <Skeleton className="h-3.5 w-20" />
                                                <Skeleton className="h-12 w-full rounded-[10px]" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
