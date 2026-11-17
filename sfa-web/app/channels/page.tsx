'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

export default function ChannelsPage() {

    const [channels, setChannels] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')

    const [form, setForm] = useState({ code: '', name: '' })
    const [editId, setEditId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)

    const fetchChannels = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/channels`, {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        setChannels(Array.isArray(data) ? data : [])

    }

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
        fetchChannels()
    }, [])

    const isAdmin = role === 'ADMINISTRATOR'

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const filteredChannels = channels.filter((c: any) => {
        const keyword = search.toLowerCase()
        return (
            c.name?.toLowerCase().includes(keyword) ||
            c.code?.toLowerCase().includes(keyword)
        )
    })

    const totalPages = Math.max(1, Math.ceil(filteredChannels.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const channelsHalamanIni = filteredChannels.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

    const handleEdit = (c: any) => {
        setEditId(c.id)
        setForm({ code: c.code || '', name: c.name || '' })
    }

    const handleCancelEdit = () => {
        setEditId(null)
        setForm({ code: '', name: '' })
    }

    const handleDelete = async (c: any) => {

        if (!confirm(`Hapus channel "${c.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
            return
        }

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/channels/${c.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message || 'Gagal menghapus channel')
            return
        }

        fetchChannels()

    }

    const handleSubmit = async (e: any) => {

        e.preventDefault()

        const token = localStorage.getItem('token')

        const url = editId
            ? `${API_BASE_URL}/channels/${editId}`
            : `${API_BASE_URL}/channels`

        const method = editId ? 'PUT' : 'POST'

        setSaving(true)

        const res = await fetch(url, {

            method,

            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(form)

        })

        const data = await res.json()

        setSaving(false)

        if (!res.ok) {
            alert(data.message || 'Gagal menyimpan channel')
            return
        }

        alert(editId ? 'Channel berhasil diupdate' : 'Channel berhasil ditambahkan')

        setForm({ code: '', name: '' })
        setEditId(null)

        fetchChannels()

    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    🏢 Channel Management
                </h1>
                <p className="text-slate-500 mt-1">
                    Channel distribusi -- dipakai Area, Class, Activity, Incentive Rule,
                    dan User untuk membatasi cakupannya.
                </p>
            </div>

            {/* FORM */}
            {isAdmin && (
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        {editId ? '✏️ Edit Channel' : '➕ Tambah Channel Baru'}
                    </h2>

                    <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4 items-end">

                        <div>
                            <label className="text-sm text-slate-500">Code</label>
                            <input
                                value={form.code}
                                onChange={(e) => setForm({ ...form, code: e.target.value })}
                                className="w-full mt-2 border rounded-xl p-3"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-sm text-slate-500">Name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="w-full mt-2 border rounded-xl p-3"
                                required
                            />
                        </div>

                        <div className="flex gap-3">

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-3 rounded-xl font-semibold"
                            >
                                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah Channel'}
                            </button>

                            {editId && (
                                <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="border border-slate-300 px-4 py-3 rounded-xl font-semibold hover:bg-slate-100"
                                >
                                    Batal
                                </button>
                            )}

                        </div>

                    </form>

                </div>
            )}

            <div className="bg-white rounded-3xl p-4 shadow flex gap-3 items-center">

                <input
                    type="text"
                    placeholder="🔍 Search channel..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 border rounded-2xl p-3"
                />

            </div>

            {/* LIST */}
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                <table className="w-full text-left">

                    <thead className="bg-slate-50 border-b border-slate-200">

                        <tr>

                            <th className="p-4 text-sm font-semibold text-slate-500">Code</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Name</th>
                            {isAdmin && (
                                <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>
                            )}

                        </tr>

                    </thead>

                    <tbody>

                        {channelsHalamanIni.map((c: any) => (

                            <tr
                                key={c.id}
                                className="border-b border-slate-100 hover:bg-slate-50"
                            >

                                <td className="p-4 text-slate-600">{c.code}</td>

                                <td className="p-4 font-semibold text-slate-900">{c.name}</td>

                                {isAdmin && (
                                    <td className="p-4 flex gap-2">
                                        <button
                                            onClick={() => handleEdit(c)}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(c)}
                                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                        >
                                            🗑 Delete
                                        </button>
                                    </td>
                                )}

                            </tr>

                        ))}

                    </tbody>

                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200">

                        <span className="text-sm text-slate-500">
                            Halaman {halamanAman} dari {totalPages} ({filteredChannels.length} channel)
                        </span>

                        <div className="flex gap-2">

                            <button
                                onClick={() => setPage(halamanAman - 1)}
                                disabled={halamanAman <= 1}
                                className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                            >
                                ‹ Sebelumnya
                            </button>

                            <button
                                onClick={() => setPage(halamanAman + 1)}
                                disabled={halamanAman >= totalPages}
                                className="border border-slate-300 disabled:opacity-40 px-4 py-2 rounded-xl text-sm"
                            >
                                Berikutnya ›
                            </button>

                        </div>

                    </div>
                )}

            </div>

        </div>
    )

}
