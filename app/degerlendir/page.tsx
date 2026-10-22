import type { Metadata } from 'next'
import { CircleAlert, Clock, MessageSquareOff } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { OrderReviewForm, type OrderReviewItem } from '@/components/reviews/OrderReviewForm'
import { getDB } from '@/lib/db'
import { originalImageUrl, productImageUrl } from '@/lib/images'
import { guestReviewsReady, loadOrderForReview, type ReviewsDb } from '@/lib/order-reviews'
import { verifyReviewToken } from '@/lib/review-link'
import { privatePageMetadata, productPath } from '@/lib/seo'

/**
 * /degerlendir/?t=<token>: the page behind the review-request e-mail (lib/order-reviews.ts). The signed token
 * (lib/review-link.ts) names one order; the page lists that order's products with 1–5 stars and an optional
 * comment each and posts to /api/reviews/order/. No account needed.
 *
 * Personal (the order's products and the customer's display name): noindex, disallowed in robots.txt, never
 * edge-cached (lib/edge-cache.ts DENY) and marked data-onopo-nocache. Every failure is a friendly message,
 * never an error page: invalid link, expired link, order not reviewable, migration not run yet.
 */
export const metadata: Metadata = {
    title: 'Ürünleri değerlendir',
    ...privatePageMetadata,
}

type View =
    | { kind: 'form'; orderId: number; reviewerName: string; items: OrderReviewItem[] }
    | { kind: 'message'; icon: React.ReactNode; title: string; description: string }

async function resolveView(token: string): Promise<View> {
    const unavailable: View = {
        kind: 'message',
        icon: <MessageSquareOff />,
        title: 'Değerlendirmeler geçici olarak kullanılamıyor',
        description: 'Bir süre sonra aynı bağlantıyı tekrar açabilirsin. Bağlantın 60 gün geçerli.',
    }
    const check = await verifyReviewToken(token, process.env.JWT_SECRET)
    if (!check.ok) {
        if (check.reason === 'no_secret') return unavailable
        if (check.reason === 'expired') {
            return {
                kind: 'message',
                icon: <Clock />,
                title: 'Bu bağlantının süresi doldu',
                description: 'Değerlendirme bağlantıları 60 gün geçerli. Ürünlerimizle ilgili görüşünü bize her zaman iletebilirsin.',
            }
        }
        return {
            kind: 'message',
            icon: <CircleAlert />,
            title: 'Bağlantı geçersiz',
            description: 'Bağlantı eksik kopyalanmış olabilir. E-postadaki "Değerlendir" düğmesine tekrar dokun.',
        }
    }
    try {
        const db = (await getDB()) as unknown as ReviewsDb
        if (!(await guestReviewsReady(db))) return unavailable
        const order = await loadOrderForReview(db, check.orderId)
        if (!order || !order.reviewable || order.items.length === 0) {
            return {
                kind: 'message',
                icon: <MessageSquareOff />,
                title: 'Bu sipariş için değerlendirme yapılamıyor',
                description: 'Sipariş iptal edilmiş ya da ürünleri artık satışta olmayabilir.',
            }
        }
        return {
            kind: 'form',
            orderId: order.id,
            reviewerName: order.reviewerName,
            items: order.items.map(i => ({
                productId: i.product_id,
                name: i.name,
                href: i.active && i.slug ? productPath(i.slug) : null,
                image: i.image ? productImageUrl(i.image, 200) : null,
                imageFallback: i.image ? originalImageUrl(i.image) : null,
                reviewed: i.reviewed,
            })),
        }
    } catch (err) {
        console.error('review_page_failed', err instanceof Error ? err.message : 'error')
        return unavailable
    }
}

export default async function OrderReviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const sp = await searchParams
    const token = typeof sp.t === 'string' ? sp.t : ''
    const view = await resolveView(token)

    return (
        <div className="min-h-[60vh] bg-surface py-8 lg:py-14">
            <div hidden data-onopo-nocache="" />
            <div className="container-store">
                <div className="mx-auto max-w-2xl rounded-sheet border border-line bg-white p-5 shadow-card sm:p-8">
                    {view.kind === 'message' ? (
                        <EmptyState icon={view.icon} title={view.title} description={view.description} action={{ label: 'Alışverişe devam et', href: '/products/' }} className="py-6" />
                    ) : (
                        <>
                            <h1 className="type-h1 text-ink">Ürünlerini değerlendir</h1>
                            <p className="mt-2 text-[15px] leading-6 text-muted">
                                #{view.orderId} numaralı siparişindeki ürünlere 1–5 yıldız ver; istersen birkaç cümle de yaz.
                                Değerlendirmen ürün sayfasında <strong className="font-semibold text-ink">{view.reviewerName}</strong> adıyla ve
                                “Doğrulanmış alıcı” etiketiyle görünür. Tam adın ve e-posta adresin gösterilmez.
                            </p>
                            <OrderReviewForm token={token} items={view.items} />
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
