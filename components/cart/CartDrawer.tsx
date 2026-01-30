"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from 'next/link'
import { useCartStore } from "@/store/cart-store"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/formatPrice"

export function CartDrawer() {
    const { isOpen, closeCart, items, removeItem, updateQuantity, totalPrice, coupon, applyCoupon, removeCoupon } = useCartStore()
    const [couponCode, setCouponCode] = React.useState('')
    const [verifying, setVerifying] = React.useState(false)
    const [couponError, setCouponError] = React.useState('')

    const handleApplyCoupon = async () => {
        if (!couponCode) return
        setVerifying(true)
        setCouponError('')
        try {
            const subtotal = items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0)
            const res = await fetch('/api/coupons/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: couponCode, cartTotal: subtotal, items: items })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error)
            applyCoupon(data.code, data.discount_type, data.discount_value)
            setCouponCode('')
        } catch (err: any) {
            setCouponError(err.message)
        } finally {
            setVerifying(false)
        }
    }

    // Prevent scrolling when cart is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCart}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Drawer - FORCED WHITE BACKGROUND */}
                    <motion.div
                        initial={{ x: "100%" }}
                        animate={{ x: 0 }}
                        exit={{ x: "100%" }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white text-slate-900 shadow-2xl flex flex-col"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <h2 className="text-xl font-heading font-bold flex items-center gap-2 text-slate-900">
                                <ShoppingBag className="w-5 h-5" /> Sepetim ({items.length})
                            </h2>
                            <Button variant="ghost" size="icon" onClick={closeCart} className="rounded-full hover:bg-slate-100 text-slate-700">
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Items */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
                            {items.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-slate-500">
                                    <ShoppingBag className="w-16 h-16 opacity-30" />
                                    <p className="text-lg font-medium">Sepetiniz boş.</p>
                                    <Button onClick={closeCart} variant="outline" className="mt-4 rounded-full px-6 border-slate-300 text-slate-700 hover:bg-white">
                                        Alışverişe Başla
                                    </Button>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <motion.div
                                        layout
                                        key={item.id}
                                        className="flex gap-4 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                                    >
                                        {/* Clickable Image -> Product Page */}
                                        <Link
                                            href={`/${item.slug || item.id}`}
                                            onClick={closeCart}
                                            className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl border border-slate-100 hover:ring-2 ring-primary transition-all"
                                        >
                                            <img
                                                src={item.image}
                                                alt={item.name}
                                                className="h-full w-full object-cover"
                                            />
                                        </Link>

                                        <div className="flex flex-1 flex-col">
                                            {/* Clickable Name -> Product Page */}
                                            <div className="flex justify-between text-base font-bold text-slate-900">
                                                <Link
                                                    href={`/${item.slug || item.id}`}
                                                    onClick={closeCart}
                                                    className="line-clamp-1 hover:text-primary transition-colors"
                                                >
                                                    {item.name}
                                                </Link>
                                                <p className="ml-4 text-slate-900 font-bold">{(item.price * item.quantity).toFixed(2)} ₺</p>
                                            </div>
                                            <p className="mt-1 text-sm text-slate-500 line-clamp-1">{item.category}</p>

                                            <div className="flex flex-1 items-end justify-between text-sm mt-3">
                                                <div className="flex items-center gap-1 border border-slate-200 bg-slate-50 rounded-lg p-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-md hover:bg-white text-slate-700"
                                                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </Button>
                                                    <span className="w-6 text-center font-bold text-slate-900">{item.quantity}</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-md hover:bg-white text-slate-700"
                                                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </Button>
                                                </div>

                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 px-2 rounded-lg"
                                                    onClick={() => removeItem(item.id)}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-1" /> Sil
                                                </Button>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))
                            )}
                        </div>

                        {/* Footer - FIXED CONTRAST */}
                        {items.length > 0 && (
                            <div className="border-t border-slate-200 p-6 bg-white">
                                {/* Coupon Input */}
                                <div className="mb-4">
                                    {coupon ? (
                                        <div className="flex items-center justify-between bg-green-50 p-2 rounded-lg border border-green-100 mb-2">
                                            <div className="flex items-center gap-2">
                                                {/* Requires Ticket icon import */}
                                                <div className="text-xs font-bold text-green-700">{coupon.code}</div>
                                                <div className="text-[10px] text-green-600">
                                                    {coupon.discountType === 'percent' ? `-%${coupon.discountValue}` : `-${coupon.discountValue}TL`}
                                                </div>
                                            </div>
                                            <button onClick={removeCoupon} className="text-red-500 hover:text-red-700">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <input
                                                placeholder="Kupon Kodu"
                                                value={couponCode}
                                                onChange={e => setCouponCode(e.target.value)}
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-slate-900"
                                            />
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={verifying}
                                                onClick={handleApplyCoupon}
                                                className="h-10"
                                            >
                                                {verifying ? '...' : 'Ekle'}
                                            </Button>
                                        </div>
                                    )}
                                    {couponError && <p className="text-[10px] text-red-500 mt-1">{couponError}</p>}
                                </div>

                                <div className="flex justify-between text-sm text-slate-500 mb-1">
                                    <p>Ara Toplam</p>
                                    <p>{formatPrice(items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0))}</p>
                                </div>
                                {coupon && (
                                    <div className="flex justify-between text-sm text-green-600 mb-2">
                                        <p>İndirim ({coupon.code})</p>
                                        <p>-{formatPrice(items.reduce((total, item) => total + (item.price || 0) * item.quantity, 0) - totalPrice())}</p>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold text-slate-900 mb-6">
                                    <p>Toplam</p>
                                    <p>{formatPrice(totalPrice())}</p>
                                </div>

                                <a href="/odeme" onClick={closeCart}>
                                    <Button className="w-full h-14 text-lg rounded-2xl bg-slate-900 text-white hover:bg-slate-800 shadow-lg font-bold flex items-center justify-center gap-2">
                                        Ödemeye Geç <ArrowRight className="w-5 h-5" />
                                    </Button>
                                </a>
                            </div>
                        )}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
