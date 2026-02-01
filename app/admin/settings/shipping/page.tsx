'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Save, Truck } from 'lucide-react'

export default function ShippingSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [settings, setSettings] = useState({
        free_shipping_threshold: 500,
        shipping_cost: 100
    })

    const logError = (msg: string, details?: any) => {
        console.error(msg, details)
        fetch('/api/admin/log', {
            method: 'POST',
            body: JSON.stringify({ message: msg, level: 'ERROR', details })
        }).catch(() => { })
    }

    useEffect(() => {
        let mounted = true
        fetch('/api/shipping-settings')
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
                        setSettings({
                            free_shipping_threshold: data.free_shipping_threshold ? parseFloat(data.free_shipping_threshold) : 500,
                            shipping_cost: data.shipping_cost ? parseFloat(data.shipping_cost) : 100
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
        setSaving(true)
        try {
            const res = await fetch('/api/shipping-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })

            if (!res.ok) throw new Error('Kaydedilemedi')

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
                                    onChange={(e) => setSettings(s => ({ ...s, free_shipping_threshold: parseFloat(e.target.value) }))}
                                    className="pl-8"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₺</span>
                            </div>
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
                                    onChange={(e) => setSettings(s => ({ ...s, shipping_cost: parseFloat(e.target.value) }))}
                                    className="pl-8"
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">₺</span>
                            </div>
                            <p className="text-xs text-slate-500">
                                Limitin altındaki siparişlerden alınacak ücret.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
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
