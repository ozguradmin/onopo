'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface InstallmentModalProps {
    isOpen: boolean
    onClose: () => void
    productPrice: number
}

export default function InstallmentModal({ isOpen, onClose, productPrice }: InstallmentModalProps) {
    const [paytrToken, setPaytrToken] = React.useState<string | null>(null)
    const [merchantId, setMerchantId] = React.useState<string | null>(null)
    const [loading, setLoading] = React.useState(true)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
        if (!isOpen) return

        // Fetch payment settings to get token and merchant_id
        const fetchSettings = async () => {
            setLoading(true)
            try {
                const res = await fetch('/api/admin/payment-settings')
                if (res.ok) {
                    const data = await res.json()
                    if (data.merchant_id) {
                        setMerchantId(data.merchant_id)
                        // Token is provided by PayTR panel - we need to get it from settings
                        // For now, use the token from payment settings if available, or generate from endpoint
                        if (data.taksit_token) {
                            setPaytrToken(data.taksit_token)
                        } else {
                            // Fetch token from our API
                            const tokenRes = await fetch('/api/installment-token')
                            if (tokenRes.ok) {
                                const tokenData = await tokenRes.json()
                                if (tokenData.token) {
                                    setPaytrToken(tokenData.token)
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch payment settings:', err)
            } finally {
                setLoading(false)
            }
        }

        fetchSettings()
    }, [isOpen])

    React.useEffect(() => {
        if (!isOpen || !paytrToken || !merchantId || !containerRef.current) return

        // Clear previous content
        containerRef.current.innerHTML = ''

        // Add PayTR styles
        const style = document.createElement('style')
        style.textContent = `
            #paytr_taksit_tablosu{clear: both;font-size: 12px;max-width: 100%;text-align: center;font-family: Arial, sans-serif;}
            #paytr_taksit_tablosu::before {display: table;content: " ";}
            #paytr_taksit_tablosu::after {content: "";clear: both;display: table;}
            .taksit-tablosu-wrapper{margin: 5px;width: 280px;padding: 12px;cursor: default;text-align: center;display: inline-block;border: 1px solid #e1e1e1;border-radius: 8px;}
            .taksit-logo img{max-height: 28px;padding-bottom: 10px;}
            .taksit-tutari-text{float: left;width: 126px;color: #a2a2a2;margin-bottom: 5px;}
            .taksit-tutar-wrapper{display: inline-block;background-color: #f7f7f7;border-radius: 4px;}
            .taksit-tutar-wrapper:hover{background-color: #e8e8e8;}
            .taksit-tutari{float: left;width: 126px;padding: 6px 0;color: #474747;border: 2px solid #ffffff;}
            .taksit-tutari-bold{font-weight: bold;}
            @media all and (max-width: 600px) {.taksit-tablosu-wrapper {margin: 5px 0;width: 100%;}}
        `
        containerRef.current.appendChild(style)

        // Add container div
        const div = document.createElement('div')
        div.id = 'paytr_taksit_tablosu'
        containerRef.current.appendChild(div)

        // Format price for PayTR (they accept formats like: 1881.38 or 162,10 or 2.640,50)
        const formattedPrice = productPrice.toFixed(2)

        // Add PayTR script
        const script = document.createElement('script')
        script.src = `https://www.paytr.com/odeme/taksit-tablosu/v2?token=${paytrToken}&merchant_id=${merchantId}&amount=${formattedPrice}&taksit=0&tumu=0`
        script.async = true
        containerRef.current.appendChild(script)

        return () => {
            // Cleanup on unmount
            if (containerRef.current) {
                containerRef.current.innerHTML = ''
            }
        }
    }, [isOpen, paytrToken, merchantId, productPrice])

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white z-10">
                            <h2 className="text-lg font-bold text-slate-900">Taksit Seçenekleri</h2>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-slate-500" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                                    <span className="ml-3 text-slate-600">Taksit seçenekleri yükleniyor...</span>
                                </div>
                            ) : !paytrToken || !merchantId ? (
                                <div className="text-center py-12">
                                    <p className="text-slate-600 mb-4">Taksit tablosu ayarları yapılandırılmamış.</p>
                                    <p className="text-sm text-slate-500">
                                        Admin Panel &gt; Ödeme Ayarları sayfasından PayTR taksit token'ını ekleyin.
                                    </p>
                                </div>
                            ) : (
                                <div ref={containerRef} className="min-h-[200px]" />
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
