'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

export default function MasterActivitiesPage() {

    const [activities, setActivities] = useState<any[]>([])
    const [channels, setChannels] = useState<any[]>([])
    const [search, setSearch] = useState('')

    const [form, setForm] = useState({
        code: '',
        name: '',
        channel_id: ''
    })

    const [editId, setEditId] = useState<number | null>(null)

    // ======================
    // FETCH
    // ======================
    const fetchData = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/activities`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json()
        setActivities(Array.isArray(data) ? data : [])
    }

    const fetchChannels = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/channels`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        })

        const data = await res.json()

        setChannels(
            Array.isArray(data.data)
                ? data.data
                : Array.isArray(data)
                    ? data
                    : []
        )
    }

    useEffect(() => {
        fetchData()
        fetchChannels()
    }, [])

    const handleChange = (e: any) => {
        setForm({
            ...form,
            [e.target.name]: e.target.value
        })
    }

    // ======================
    // SAVE
    // ======================
    const handleSubmit = async (e: any) => {
        e.preventDefault()

        const token = localStorage.getItem('token')

        const url = editId
            ? `${API_BASE_URL}/activities/${editId}`
            : `${API_BASE_URL}/activities`

        const method = editId ? 'PUT' : 'POST'

        await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                ...form,
                channel_id: form.channel_id || null
            })
        })

        setForm({ code: '', name: '', channel_id: '' })
        setEditId(null)
        fetchData()
    }

    const handleEdit = (a: any) => {
        setEditId(a.id)
        setForm({
            code: a.code,
            name: a.name,
            channel_id: a.channel_id ? String(a.channel_id) : ''
        })
    }

    const handleCancelEdit = () => {
        setEditId(null)
        setForm({ code: '', name: '', channel_id: '' })
    }

    const handleDelete = async (a: any) => {

        if (!confirm(`Hapus activity "${a.name}"? Tindakan ini tidak bisa dibatalkan.`)) {
            return
        }

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/activities/${a.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.message || 'Gagal menghapus activity')
            return
        }

        fetchData()

    }

    const channelName = (channelId: number | null) => {

        if (!channelId) return 'Semua Channel'

        const c = channels.find((ch: any) => ch.id === channelId)

        return c ? c.name : 'Semua Channel'
    }

    const filtered = activities.filter((a) =>
        a.name?.toLowerCase().includes(search.toLowerCase()) ||
        a.code?.toLowerCase().includes(search.toLowerCase())
    )

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const activitiesHalamanIni = filtered.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    📌 Activity Master
                </h1>
                <p className="text-slate-500 mt-1">
                    Manage master activity for visit system
                </p>
            </div>

            {/* FORM */}
            <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                <h2 className="font-bold text-slate-900">
                    {editId ? '✏️ Edit Activity' : '➕ Create Activity'}
                </h2>

                <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4">

                    <div>
                        <label className="text-sm text-slate-500">Code</label>
                        <input
                            name="code"
                            placeholder="Code"
                            value={form.code}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-500">Activity Name</label>
                        <input
                            name="name"
                            placeholder="Activity Name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        />
                    </div>

                    <div>
                        <label className="text-sm text-slate-500">Channel</label>
                        <select
                            name="channel_id"
                            value={form.channel_id}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        >
                            <option value="">Semua Channel</option>
                            {channels.map((c: any) => (
                                <option key={c.id} value={c.id}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="md:col-span-3 flex gap-3">

                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl font-semibold shadow"
                        >
                            {editId ? 'Update' : 'Save'}
                        </button>

                        {editId && (
                            <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="border border-slate-300 px-5 py-3 rounded-2xl font-semibold hover:bg-slate-100"
                            >
                                Batal
                            </button>
                        )}

                    </div>

                </form>

            </div>

            {/* SEARCH */}
            <div className="bg-white rounded-3xl p-4 shadow flex gap-3 items-center">

                <input
                    type="text"
                    placeholder="🔍 Search code, name..."
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
                            <th className="p-4 text-sm font-semibold text-slate-500">Activity Name</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Channel</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>
                        </tr>

                    </thead>

                    <tbody>

                        {activitiesHalamanIni.map((a: any) => (

                            <tr
                                key={a.id}
                                className="border-b border-slate-100 hover:bg-slate-50"
                            >

                                <td className="p-4 text-slate-600">{a.code}</td>

                                <td className="p-4 font-semibold text-slate-900">{a.name}</td>

                                <td className="p-4">
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-semibold ${a.channel_id
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'bg-slate-100 text-slate-500'
                                            }`}
                                    >
                                        {channelName(a.channel_id)}
                                    </span>
                                </td>

                                <td className="p-4 flex gap-2">
                                    <button
                                        onClick={() => handleEdit(a)}
                                        className="bg-blue-600 text-white py-2 px-3 rounded-xl font-semibold text-sm"
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(a)}
                                        className="bg-red-600 text-white py-2 px-3 rounded-xl font-semibold text-sm"
                                    >
                                        🗑 Delete
                                    </button>
                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200">

                        <span className="text-sm text-slate-500">
                            Halaman {halamanAman} dari {totalPages} ({filtered.length} activity)
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
