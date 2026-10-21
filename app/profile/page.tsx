import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight, Heart, Mail, Package, UserRound } from 'lucide-react'
import { AccountShell } from '@/components/account/AccountShell'
import { ProfileForm } from '@/components/account/ProfileForm'
import { ProductCard } from '@/components/product/ProductCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { countAccountOrders, getFavoriteProductIds, getSessionUser } from '@/lib/account'
import { getActiveProducts, getShippingSettings, type Product } from '@/lib/catalog'
import { formatDateTR } from '@/lib/format'
import { privatePageMetadata } from '@/lib/seo'
import { getReviewStatsMapSafe } from '@/lib/reviews'

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function tabOf(sp: Record<string, string | string[] | undefined>): 'profile' | 'favorites' {
    const tab = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab
    return tab === 'favorites' || tab === 'favoriler' ? 'favorites' : 'profile'
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
    const tab = tabOf(await searchParams)
    return { title: tab === 'favorites' ? 'Favorilerim' : 'Hesabım', ...privatePageMetadata }
}

export default async function ProfilePage({ searchParams }: { searchParams: SearchParams }) {
    const tab = tabOf(await searchParams)
    const user = await getSessionUser()
    if (!user) {
        redirect(`/login/?redirect=${encodeURIComponent(tab === 'favorites' ? '/profile/?tab=favorites' : '/profile/')}`)
    }

    const [favoriteIds, products] = await Promise.all([getFavoriteProductIds(user.id), getActiveProducts()])
    const byId = new Map(products.map(p => [p.id, p]))
    const favorites = favoriteIds.map(id => byId.get(id)).filter((p): p is Product => !!p)

    if (tab === 'favorites') {
        const shipping = await getShippingSettings()
        const ratings = favorites.length > 0 ? await getReviewStatsMapSafe() : null
        return (
            <AccountShell
                user={user}
                active="favorites"
                title="Favorilerim"
                description={favorites.length ? `${favorites.length} ürün` : undefined}
            >
                {favorites.length === 0 ? (
                    <div className="rounded-sheet border border-line bg-white shadow-card">
                        <EmptyState
                            icon={<Heart />}
                            title="Henüz favorin yok"
                            description="Beğendiğin ürünlerdeki kalbe dokun; hepsi burada seni bekler."
                            action={{ label: 'Ürünleri keşfet', href: '/products/' }}
                        />
                    </div>
                ) : (
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-5">
                        {favorites.map((product, i) => (
                            <li key={product.id} className="flex">
                                <ProductCard
                                    product={product}
                                    priority={i < 3}
                                    headingLevel="h2"
                                    freeShippingThreshold={shipping.freeShippingThreshold}
                                    rating={ratings ? ratings.get(product.id) ?? null : undefined}
                                    sizes="(max-width: 640px) 46vw, (max-width: 1024px) 31vw, 280px"
                                    className="w-full"
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </AccountShell>
        )
    }

    const orderCount = await countAccountOrders(user)
    const memberSince = formatDateTR(user.createdAt)

    return (
        <AccountShell user={user} active="profile" title="Hesabım" description={memberSince ? `${memberSince} tarihinden beri üyesin` : undefined}>
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
                <Link
                    href="/orders/"
                    className="group flex items-center gap-3 rounded-sheet border border-line bg-white p-4 shadow-card transition-colors hover:border-line-strong lg:p-5"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-50 text-brand-600" aria-hidden="true">
                        <Package className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">Siparişlerim</span>
                        <span className="block text-[13px] text-muted">{orderCount ? `${orderCount} sipariş` : 'Henüz sipariş yok'}</span>
                    </span>
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
                </Link>
                <Link
                    href="/profile/?tab=favorites"
                    className="group flex items-center gap-3 rounded-sheet border border-line bg-white p-4 shadow-card transition-colors hover:border-line-strong lg:p-5"
                >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-sale-50 text-sale" aria-hidden="true">
                        <Heart className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-ink">Favorilerim</span>
                        <span className="block text-[13px] text-muted">{favorites.length ? `${favorites.length} ürün` : 'Henüz favori yok'}</span>
                    </span>
                    <ChevronRight className="hidden h-5 w-5 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
                </Link>
            </div>

            <div className="mt-4 grid gap-4 lg:mt-5 lg:grid-cols-5 lg:items-start lg:gap-5">
                <section aria-labelledby="account-info-title" className="rounded-sheet border border-line bg-white p-4 shadow-card sm:p-6 lg:col-span-2">
                    <h2 id="account-info-title" className="type-h3 text-ink">
                        Hesap bilgileri
                    </h2>
                    <dl className="mt-4 space-y-4 text-sm">
                        <div className="flex items-start gap-3">
                            <UserRound className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
                            <div className="min-w-0">
                                <dt className="text-[13px] text-muted">Ad soyad</dt>
                                <dd className="mt-0.5 font-medium text-ink">{user.fullName || '—'}</dd>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <Mail className="mt-0.5 h-[18px] w-[18px] shrink-0 text-muted" aria-hidden="true" />
                            <div className="min-w-0">
                                <dt className="text-[13px] text-muted">E-posta</dt>
                                <dd className="mt-0.5 break-all font-medium text-ink">{user.email}</dd>
                            </div>
                        </div>
                    </dl>
                    <p className="mt-5 rounded-card bg-surface px-3.5 py-3 text-[13px] leading-5 text-muted">
                        Ad soyad veya e-posta adresini değiştirmek için bize ulaşabilirsin.
                    </p>
                </section>

                <section aria-labelledby="account-address-title" className="rounded-sheet border border-line bg-white p-4 shadow-card sm:p-6 lg:col-span-3">
                    <h2 id="account-address-title" className="type-h3 text-ink">
                        İletişim ve teslimat adresi
                    </h2>
                    <p className="mb-5 mt-1 text-[13px] leading-5 text-muted">Ödeme sayfasında bu bilgiler otomatik doldurulur.</p>
                    <ProfileForm
                        initial={{
                            phone: user.phone,
                            address: user.address,
                            city: user.city,
                            district: user.district,
                            postalCode: user.postalCode,
                        }}
                    />
                </section>
            </div>
        </AccountShell>
    )
}
