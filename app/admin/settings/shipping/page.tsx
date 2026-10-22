'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label_new"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Save, Truck } from 'lucide-react'

// Same defaults as the storefront and the order API (lib/pricing.ts, lib/catalog.ts) when nothing valid is stored
const DEFAULT_THRESHOLD = 500
const DEFAULT_COST = 100

// The number input's value ('' when it is empty or not a number): a finite amount >= 0, else null
function parseAmount(value: string): number | null {
    if (value.trim() === '') return null
    const n = Number(value)
    return Number.isFinite(n) && n >= 0 ? n : null
}

function storedOr(value: unknown, fallback: number): string {
    const n = parseFloat(String(value ?? ''))
    return String(Number.isFinite(n) ? n : fallback)
}

export default function ShippingSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    // Kept as the inputs' text, so an empty or invalid field is visible and never sent as null
    const [settings, setSettings] = useState({
        free_shipping_threshold: String(DEFAULT_THRESHOLD),
        shipping_cost: String(DEFAULT_COST)
    })
    const threshold = parseAmount(settings.free_shipping_threshold)
    const cost = parseAmount(settings.shipping_cost)
    const valid = threshold !== null && cost !== null

    const logError = (msg: string, details?: any) => {
        console.error(msg, details)
        fetch('/api/admin/log', {
            method: 'POST',
            body: JSON.stringify({ message: msg, level: 'ERROR', details })
        }).catch(() => { })
    }

    useEffect(() => {
        let mounted = true
        // no-store: the public answer is cached for minutes; show what is really stored
        fetch('/api/shipping-settings', { cache: 'no-store' })
            .then(async res => {
                if (!res.ok) {
                    const txt = await res.text()
                    throw new Error(`API Error: ${res.status} ${txt}`)
                }
                return res.json()
            })
            .then(data => {
                if (!mounted) return
                if (data && !data.error) {
                    try {
                        // 0 is a valid amount (always free / free shipping); only missing or invalid values get the default
                        setSettings({
                            free_shipping_threshold: storedOr(data.free_shipping_threshold, DEFAULT_THRESHOLD),
                            shipping_cost: storedOr(data.shipping_cost, DEFAULT_COST)
                        })
                    } catch (e: any) {
                        logError('Parsing error', { error: e.toString(), data })
                    }
                } else {
                    if (data?.error) logError('Data error', data)
                }
                setLoading(false)
            })
            .catch((err) => {
                if (mounted) {
                    logError('Fetch error', { error: err.toString() })
                    setLoading(false)
                }
            })
        return () => { mounted = false }
    }, [])

    const handleSave = async () => {
        if (threshold === null || cost === null) return
        setSaving(true)
        try {
            const res = await fetch('/api/shipping-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ free_shipping_threshold: threshold, shipping_cost: cost })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => null)
                if (res.status === 400 && data?.error) {
                    toast.error("Kaydedilmedi", { description: String(data.error) })
                    return
                }
                throw new Error('Kaydedilemedi')
            }

            toast.success("Başarılı", {
                description: "Kargo ayarları güncellendi.",
            })
        } catch (error: any) {
            logError('Save error', { error: error.toString() })
            toast.error("Hata", {
                description: "Ayarlar kaydedilirken bir hata oluştu.",
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div>Yükleniyor...</div>

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-slate-900">Kargo Ayarları</h1>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-blue-600" />
                        <CardTitle>Genel Kargo Kuralları</CardTitle>
                    </div>
                    <CardDescription>
                        Sipariş tutarına göre kargo ücreti belirleyin.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="threshold">Ücretsiz Kargo Limiti (TL)</Label>
                            <div className="relative">
                                <Input
                                    id="threshold"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={settings.free_shipping_threshold}
                                    onChange={(e) => setSettings(s => ({ ...s, free_shipping_threshold: e.target.value }))}
                                    aria-invalid={threshold === null}
                                    aria-describedby={threshold === null ? 'threshold-error' : undefined}
                                    className={`pl-8 ${threshold === null ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₺</span>
                            </div>
                            {threshold === null && (
                                <p id="threshold-error" className="text-xs font-medium text-red-600">
                                    Geçerli bir tutar gir: 0 ya da daha büyük bir sayı.
                                </p>
                            )}
                            <p className="text-xs text-slate-500">
                                Bu tutarın üzerindeki siparişlerde kargo ücretsiz olur.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="cost">Kargo Ücreti (TL)</Label>
                            <div className="relative">
                                <Input
                                    id="cost"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={settings.shipping_cost}
                                    onChange={(e) => setSettings(s => ({ ...s, shipping_cost: e.target.value }))}
                                    aria-invalid={cost === null}
                                    aria-describedby={cost === null ? 'cost-error' : undefined}
                                    className={`pl-8 ${cost === null ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₺</span>
                            </div>
                            {cost === null && (
                                <p id="cost-error" className="text-xs font-medium text-red-600">
                                    Geçerli bir tutar gir: 0 ya da daha büyük bir sayı.
                                </p>
                            )}
                            <p className="text-xs text-slate-500">
                                Limitin altındaki siparişlerden alınacak ücret.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving || !valid}
                            className="bg-slate-900 text-white hover:bg-slate-800 gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Kaydediliyor...' : 'Kaydet'}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
