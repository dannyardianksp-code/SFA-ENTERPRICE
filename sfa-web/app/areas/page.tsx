'use client'

import { useEffect, useState } from 'react'

const DEFAULT_RADIUS = 50

export default function AreasPage() {

    const [areas, setAreas] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')

    const [form, setForm] = useState({ code: '', name: '', checkin_radius_meters: '' })
    const [editId, setEditId] = useState<number | null>(null)
    const [saving, setSaving] = useState(false)

    const fetchAreas = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch('http://localhost:1000/api/areas', {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        setAreas(Array.isArray(data) ? data : [])

    }

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
        fetchAreas()
    }, [])

    const isAdmin = role === 'ADMINISTRATOR'

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const filteredAreas = areas.filter((a: any) => {
        const keyword = search.toLowerCase()
        return (
            a.name?.toLowerCase().includes(keyword) ||
            a.code?.toLowerCase().includes(keyword)
        )
    })

    const totalPages = Math.max(1, Math.ceil(filteredAreas.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const areasHalamanIni = filteredAreas.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

    const handleEdit = (a: any) => {
        setEditId(a.id)
        setForm({
            code: a.code || '',
            name: a.name || '',
            checkin_radius_meters:
                a.checkin_radius_meters != null ? String(a.checkin_radius_meters) : ''
        })
    }

    const handleCancelEdit = () => {
        setEditId(null)
        setForm({ code: '', name: '', checkin_radius_meters: '' })
    }

    const handleSubmit = async (e: any) => {

        e.preventDefault()

        const token = localStorage.getItem('token')

        const url = editId
            ? `http://localhost:1000/api/areas/${editId}`
            : `http://localhost:1000/api/areas`

        const method = editId ? 'PUT' : 'POST'

        setSaving(true)

        const res = await fetch(url, {

            method,

            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify({
                code: form.code,
                name: form.name,
                checkin_radius_meters: form.checkin_radius_meters || null
            })

        })

        const data = await res.json()

        setSaving(false)

        if (!res.ok) {
            alert(data.message || 'Gagal menyimpan area')
            return
        }

        alert(editId ? 'Area berhasil diupdate' : 'Area berhasil ditambahkan')

        setForm({ code: '', name: '', checkin_radius_meters: '' })
        setEditId(null)

        fetchAreas()

    }

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    📍 Area Management
                </h1>
                <p className="text-slate-500 mt-1">
                    Radius check-in kunjungan per area -- kosong berarti pakai default {DEFAULT_RADIUS} meter.
                </p>
            </div>

            {/* FORM */}
            {isAdmin && (
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        {editId ? '✏️ Edit Area' : '➕ Tambah Area Baru'}
                    </h2>

                    <form onSubmit={handleSubmit} className="grid md:grid-cols-4 gap-4 items-end">

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

                        <div>
                            <label className="text-sm text-slate-500">
                                Radius (meter, opsional)
                            </label>
                            <input
                                type="number"
                                min={1}
                                placeholder={String(DEFAULT_RADIUS)}
                                value={form.checkin_radius_meters}
                                onChange={(e) =>
                                    setForm({ ...form, checkin_radius_meters: e.target.value })
                                }
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                        <div className="flex gap-3">

                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-3 rounded-xl font-semibold"
                            >
                                {saving ? 'Menyimpan...' : editId ? 'Update' : 'Tambah Area'}
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
                    placeholder="🔍 Search area..."
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
                            <th className="p-4 text-sm font-semibold text-slate-500">Radius Check-in (meter)</th>
                            {isAdmin && (
                                <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>
                            )}

                        </tr>

                    </thead>

                    <tbody>

                        {areasHalamanIni
                            .map((a: any) => (

                                <tr
                                    key={a.id}
                                    className="border-b border-slate-100 hover:bg-slate-50"
                                >

                                    <td className="p-4 text-slate-600">{a.code}</td>

                                    <td className="p-4 font-semibold text-slate-900">{a.name}</td>

                                    <td className="p-4 text-slate-600">
                                        {a.checkin_radius_meters ?? `${DEFAULT_RADIUS} (default)`}
                                    </td>

                                    {isAdmin && (
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleEdit(a)}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                                            >
                                                Edit
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
                            Halaman {halamanAman} dari {totalPages} ({filteredAreas.length} area)
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
