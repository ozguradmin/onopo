// Order statuses (orders.status) with their Turkish labels: the one list BirFatura and the admin panel share.
// Plain module without server imports, so client pages can use it; lib/birfatura.ts re-exports it.

// BirFatura bu ID'leri saklar ve geri gönderir; değerleri değiştirmeyin.
export const ORDER_STATUSES: { id: number; status: string; label: string }[] = [
    { id: 1, status: 'approved', label: 'Onaylandı' },
    { id: 2, status: 'processing', label: 'Hazırlanıyor' },
    { id: 3, status: 'shipped', label: 'Kargoya Verildi' },
    { id: 4, status: 'completed', label: 'Tamamlandı' },
    { id: 5, status: 'pending', label: 'Beklemede' },
    { id: 6, status: 'cancelled', label: 'İptal Edildi' },
]
