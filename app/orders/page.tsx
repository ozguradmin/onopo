import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { PackageOpen } from 'lucide-react'
import { AccountShell } from '@/components/account/AccountShell'
import { OrderCard, type OrderCardProduct } from '@/components/account/OrderCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { getAccountOrders, getSessionUser } from '@/lib/account'
import { getActiveProducts } from '@/lib/catalog'
import { privatePageMetadata } from '@/lib/seo'

export const metadata: Metadata = {
    title: 'Siparişlerim',
    ...privatePageMetadata,
}

// Customer order history, rendered on the server from the session cookie (same orders as
// /api/orders/my-orders: user_id = me OR guest_email = my e-mail).
export default async function OrdersPage() {
    const user = await getSessionUser()
    if (!user) redirect(`/login/?redirect=${encodeURIComponent('/orders/')}`)

    const [orders, products] = await Promise.all([getAccountOrders(user), getActiveProducts()])
    const productMap = new Map<number, OrderCardProduct>(products.map(p => [p.id, { slug: p.slug, image: p.image }]))

    return (
        <AccountShell user={user} active="orders" title="Siparişlerim" description={orders.length ? `${orders.length} sipariş` : undefined}>
            {orders.length === 0 ? (
                <div className="rounded-sheet border border-line bg-white shadow-card">
                    <EmptyState
                        icon={<PackageOpen />}
                        title="Henüz siparişin yok"
                        description="Verdiğin siparişler, kargo takip numaraları ve faturaların burada listelenir."
                        action={{ label: 'Alışverişe başla', href: '/products/' }}
                    />
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map(order => (
                        <OrderCard key={order.id} order={order} products={productMap} />
                    ))}
                </div>
            )}
        </AccountShell>
    )
}
