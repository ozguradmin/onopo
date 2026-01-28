'use client'

import * as React from 'react'
import { Users, Mail, Phone, Calendar, Shield } from 'lucide-react'

export default function AdminUsersPage() {
    const [users, setUsers] = React.useState<any[]>([])
    const [total, setTotal] = React.useState(0)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
        fetch('/api/admin/users')
            .then(res => res.json())
            .then(data => {
                if (data.users) setUsers(data.users)
                if (data.total) setTotal(data.total)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    if (loading) return <div className="p-8 text-center text-slate-500">Yükleniyor...</div>

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-slate-900">Kullanıcılar</h1>
                <div className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-xl">
                    <Users className="w-5 h-5 text-slate-500" />
                    <span className="font-bold text-slate-900">{total}</span>
                    <span className="text-sm text-slate-500">toplam kullanıcı</span>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Ad Soyad</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">E-posta</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Telefon</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Rol</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Kayıt Tarihi</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm text-slate-500">#{user.id}</td>
                                <td className="px-4 py-3">
                                    <span className="font-medium text-slate-900">{user.full_name || '-'}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">{user.email}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-slate-400" />
                                        <span className="text-sm text-slate-600">{user.phone || '-'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        <Shield className="w-3 h-3" />
                                        {user.role === 'admin' ? 'Admin' : 'Kullanıcı'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2 text-sm text-slate-500">
                                        <Calendar className="w-4 h-4" />
                                        {new Date(user.created_at).toLocaleDateString('tr-TR')}
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {users.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                    Henüz kullanıcı yok
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
