
'use client'

import { useState, useEffect } from 'react'
import { Save, ExternalLink, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export default function PaymentSettingsPage() {
    const [settings, setSettings] = useState<any>({
        provider: 'offline',
        is_active: 0,
        api_key: '',
        secret_key: '',
        merchant_id: '',
        merchant_salt: '',
        base_url: '',
        test_mode: 1
    })
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'general' | 'paytr' | 'iyzico'>('general')

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/admin/payment-settings')
            if (res.ok) {
                const data = await res.json()
                if (data && Object.keys(data).length > 0) {
                    setSettings({
                        ...settings,
                        ...data,
                        is_active: data.is_active || 0,
                        test_mode: data.test_mode ?? 1
                    })
                }
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/admin/payment-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            })
            if (res.ok) {
                toast.success('Ödeme ayarları kaydedildi!')
            } else {
                const data = await res.json()
                toast.error(data.error || 'Kayıt başarısız')
            }
        } catch (error) {
            console.error(error)
            toast.error('Bir hata oluştu')
        } finally {
            setSaving(false)
        }
    }

    const TabButton = ({ id, label }: { id: typeof activeTab, label: string }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${activeTab === id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
        >
            {label}
        </button>
    )

    if (loading) return <div className="p-8">Yükleniyor...</div>

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Ödeme Yöntemi Ayarları</h1>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-slate-200">
                    <TabButton id="general" label="Genel Ayarlar" />
                    <TabButton id="paytr" label="PayTR Entegrasyonu" />
                    <TabButton id="iyzico" label="Iyzico Entegrasyonu" />
                </div>

                <div className="p-6">
                    {activeTab === 'general' && (
                        <div className="space-y-6 max-w-lg">
                            <div>
                                <label className="block text-sm font-medium mb-2">Aktif Ödeme Yöntemi</label>
                                <select
                                    className="w-full p-2 border border-slate-300 rounded-lg"
                                    value={settings.provider}
                                    onChange={e => setSettings({ ...settings, provider: e.target.value })}
                                >
                                    <option value="offline">Sadece Havale/Kapıda Ödeme</option>
                                    <option value="paytr">PayTR (Kredi Kartı)</option>
                                    <option value="iyzico">Iyzico (Kredi Kartı)</option>
                                </select>
                                <p className="text-xs text-slate-500 mt-2">
                                    Seçtiğiniz yöntem ödeme sayfasında aktif olacaktır.
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="active_check"
                                    checked={settings.is_active === 1 || settings.is_active === true}
                                    onChange={e => setSettings({ ...settings, is_active: e.target.checked ? 1 : 0 })}
                                    className="w-4 h-4 text-indigo-600"
                                />
                                <label htmlFor="active_check" className="text-sm font-medium">Ödeme Sistemini Aktifleştir</label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'paytr' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg flex items-center gap-2">
                                    PayTR API Bilgileri
                                </h3>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Merchant ID (Mağaza No)</label>
                                    <Input value={settings.merchant_id || ''} onChange={e => setSettings({ ...settings, merchant_id: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Merchant Key (Mağaza Parolası)</label>
                                    <Input value={settings.api_key || ''} onChange={e => setSettings({ ...settings, api_key: e.target.value })} type="password" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Merchant Salt (Gizli Anahtar)</label>
                                    <Input value={settings.merchant_salt || ''} onChange={e => setSettings({ ...settings, merchant_salt: e.target.value })} type="password" />
                                </div>
                            </div>

                            <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-sm space-y-4">
                                <h4 className="font-bold text-indigo-900 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Kurulum Rehberi
                                </h4>
                                <ol className="list-decimal ml-4 space-y-2 text-indigo-800">
                                    <li><a href="https://www.paytr.com/magaza/bilgi" target="_blank" className="underline font-semibold">PayTR Mağaza Paneli</a>'ne giriş yapın.</li>
                                    <li>Sol menüden <strong>Bilgi</strong> sayfasına tıklayın.</li>
                                    <li>API Entegrasyon Bilgileri bölümünden gerekli anahtarları kopyalayın.</li>
                                    <li><strong>ÖNEMLİ:</strong> IP adresinizi PayTR paneline kaydetmeyi unutmayın. Geliştirme yapıyorsanız kendi IP'nizi ekleyin.</li>
                                </ol>
                                <div className="mt-4 pt-4 border-t border-indigo-200">
                                    <p className="font-semibold">Callback URL Tanımlama</p>
                                    <code className="block bg-white p-2 mt-1 rounded text-xs select-all">
                                        {typeof window !== 'undefined' ? window.location.origin : ''}/api/payment/callback/paytr/result
                                    </code>
                                    <p className="mt-1 text-xs">Bu URL'i PayTR paneline girmeniz gerekebilir.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'iyzico' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <h3 className="font-semibold text-lg">Iyzico API Bilgileri</h3>
                                <div>
                                    <label className="block text-sm font-medium mb-1">API Key</label>
                                    <Input value={settings.api_key} onChange={e => setSettings({ ...settings, api_key: e.target.value })} type="password" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Secret Key</label>
                                    <Input value={settings.secret_key} onChange={e => setSettings({ ...settings, secret_key: e.target.value })} type="password" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-1">Base URL</label>
                                    <select
                                        className="w-full p-2 border border-slate-300 rounded-lg text-sm"
                                        value={settings.base_url}
                                        onChange={e => setSettings({ ...settings, base_url: e.target.value })}
                                    >
                                        <option value="https://sandbox-api.iyzipay.com">Sandbox (Test Ortamı)</option>
                                        <option value="https://api.iyzipay.com">Production (Canlı Ortam)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 text-sm space-y-4">
                                <h4 className="font-bold text-blue-900 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Kurulum Rehberi
                                </h4>
                                <ol className="list-decimal ml-4 space-y-2 text-blue-800">
                                    <li><a href="https://merchant.iyzipay.com/settings" target="_blank" className="underline font-semibold">Iyzico Satıcı Paneli</a>'ne giriş yapın.</li>
                                    <li><strong>Ayarlar</strong> menüsüne gidin.</li>
                                    <li>API Anahtarları bölümünden Key ve Secret değerlerini alın.</li>
                                    <li>Test yapmak için Sandbox hesabınızı kullanmanızı öneririz.</li>
                                </ol>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <Button onClick={handleSave} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                        <Save className="w-4 h-4" />
                        Kaydet
                    </Button>
                </div>
            </div>
        </div>
    )
}
