'use client'

import * as React from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert, inputClass, textareaClass } from '@/components/forms/Field'

export interface ProfileFormValues {
    phone: string
    address: string
    city: string
    district: string
    postalCode: string
}

/**
 * Contact and delivery address of the account. Saves with PUT /api/user/update-profile
 * { phone, address, city, district, postal_code } (same payload as before); checkout pre-fills from it.
 */
export function ProfileForm({ initial }: { initial: ProfileFormValues }) {
    const [phone, setPhone] = React.useState(initial.phone)
    const [address, setAddress] = React.useState(initial.address)
    const [city, setCity] = React.useState(initial.city)
    const [district, setDistrict] = React.useState(initial.district)
    const [postalCode, setPostalCode] = React.useState(initial.postalCode)
    const [saving, setSaving] = React.useState(false)
    const [status, setStatus] = React.useState<'idle' | 'saved' | 'error'>('idle')

    React.useEffect(() => {
        if (status !== 'saved') return
        const t = setTimeout(() => setStatus('idle'), 3000)
        return () => clearTimeout(t)
    }, [status])

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setStatus('idle')
        try {
            const res = await fetch('/api/user/update-profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, address, city, district, postal_code: postalCode }),
            })
            if (res.ok) {
                const data = await res.json()
                if (data?.user) {
                    setPhone(data.user.phone || '')
                    setAddress(data.user.address || '')
                    setCity(data.user.city || '')
                    setDistrict(data.user.district || '')
                    setPostalCode(data.user.postal_code || '')
                }
                setStatus('saved')
            } else {
                setStatus('error')
            }
        } catch (err) {
            console.error('Save error:', err)
            setStatus('error')
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={handleSaveProfile} className="space-y-4">
            <Field id="profile-phone" label="Telefon" hint="Kargo ve sipariş bilgilendirmesi için.">
                <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    autoComplete="tel"
                    className={inputClass}
                    placeholder="05XX XXX XX XX"
                />
            </Field>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Field id="profile-city" label="İl">
                    <input
                        type="text"
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        autoComplete="address-level1"
                        className={inputClass}
                        placeholder="örn. İstanbul"
                    />
                </Field>
                <Field id="profile-district" label="İlçe">
                    <input
                        type="text"
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        autoComplete="address-level2"
                        className={inputClass}
                        placeholder="örn. Kadıköy"
                    />
                </Field>
            </div>
            <Field id="profile-address" label="Adres">
                <textarea
                    value={address}
                    onChange={e => setAddress(e.target.value)}
                    autoComplete="street-address"
                    className={textareaClass}
                    rows={2}
                    placeholder="Mahalle, sokak, bina no, daire no"
                />
            </Field>
            <Field id="profile-postalCode" label="Posta kodu" optional className="sm:max-w-[50%] sm:pr-2">
                <input
                    type="text"
                    value={postalCode}
                    onChange={e => setPostalCode(e.target.value)}
                    autoComplete="postal-code"
                    inputMode="numeric"
                    className={inputClass}
                    placeholder="örn. 34000"
                />
            </Field>

            <div aria-live="polite">
                {status === 'saved' && <FormAlert tone="success">Bilgilerin kaydedildi. Bir sonraki siparişinde otomatik doldurulacak.</FormAlert>}
                {status === 'error' && <FormAlert>Bilgiler kaydedilemedi. Lütfen tekrar dene.</FormAlert>}
            </div>

            <Button type="submit" variant="brand" size="48" isLoading={saving} className="w-full sm:w-auto">
                {!saving && <Save className="h-[18px] w-[18px]" aria-hidden="true" />}
                {saving ? 'Kaydediliyor…' : 'Değişiklikleri kaydet'}
            </Button>
        </form>
    )
}
