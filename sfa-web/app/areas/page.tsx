'use client'

import { useEffect, useState } from 'react'

const DEFAULT_RADIUS = 50

export default function AreasPage() {

    const [areas, setAreas] = useState<any[]>([])
    const [search, setSearch] = useState('')
    const [role, setRole] = useState('')
    const [drafts, setDrafts] = useState<Record<number, string>>({})
    const [savingId, setSavingId] = useState<number | null>(null)

    const [form, setForm] = useState({ code: '', name: '', checkin_radius_meters: '' })
    const [creating, setCreating] = useState(false)

    const fetchAreas = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch('http://localhost:1000/api/areas', {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        const list = Array.isArray(data) ? data : []

        setAreas(list)

        setDrafts(
            Object.fromEntries(
                list.map((a: any) => [
                    a.id,
                    a.checkin_radius_meters != null ? String(a.checkin_radius_meters) : ''
                ])
            )
        )

    }

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
        fetchAreas()
    }, [])

    const isAdmin = role === 'ADMINISTRATOR'

    const handleSave = async (id: number) => {

        const token = localStorage.getItem('token')
        const nilai = drafts[id]

        setSavingId(id)

        const res = await fetch(`http://localhost:1000/api/areas/${id}`, {

            method: 'PUT',

            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify({
                checkin_radius_meters: nilai === '' ? null : nilai
            })

        })

        const data = await res.json()

        setSavingId(null)

        if (!res.ok) {
            alert(data.message || 'Gagal menyimpan radius')
            return
        }

        fetchAreas()

    }

    const handleCreate = async (e: any) => {

        e.preventDefault()

        const token = localStorage.getItem('token')

        setCreating(true)

        const res = await fetch('http://localhost:1000/api/areas', {

            method: 'POST',

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

        setCreating(false)

        if (!res.ok) {
            alert(data.message || 'Gagal menambah area')
            return
        }

        setForm({ code: '', name: '', checkin_radius_meters: '' })

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

            {/* TAMBAH AREA */}
            {isAdmin && (
                <div className="bg-white rounded-3xl p-6 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        ➕ Tambah Area Baru
                    </h2>

                    <form onSubmit={handleCreate} className="grid md:grid-cols-4 gap-4 items-end">

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

                        <button
                            type="submit"
                            disabled={creating}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white py-3 rounded-xl font-semibold"
                        >
                            {creating ? 'Menyimpan...' : 'Tambah Area'}
                        </button>

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

                        {areas
                            .filter((a: any) => {
                                const keyword = search.toLowerCase()
                                return (
                                    a.name?.toLowerCase().includes(keyword) ||
                                    a.code?.toLowerCase().includes(keyword)
                                )
                            })
                            .map((a: any) => (

                                <tr
                                    key={a.id}
                                    className="border-b border-slate-100 hover:bg-slate-50"
                                >

                                    <td className="p-4 text-slate-600">{a.code}</td>

                                    <td className="p-4 font-semibold text-slate-900">{a.name}</td>

                                    <td className="p-4">
                                        {isAdmin ? (
                                            <input
                                                type="number"
                                                min={1}
                                                placeholder={String(DEFAULT_RADIUS)}
                                                value={drafts[a.id] ?? ''}
                                                onChange={(e) =>
                                                    setDrafts({ ...drafts, [a.id]: e.target.value })
                                                }
                                                className="w-28 border rounded-xl p-2"
                                            />
                                        ) : (
                                            <span className="text-slate-600">
                                                {a.checkin_radius_meters ?? `${DEFAULT_RADIUS} (default)`}
                                            </span>
                                        )}
                                    </td>

                                    {isAdmin && (
                                        <td className="p-4">
                                            <button
                                                onClick={() => handleSave(a.id)}
                                                disabled={savingId === a.id}
                                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-xl text-sm"
                                            >
                                                {savingId === a.id ? 'Menyimpan...' : 'Simpan'}
                                            </button>
                                        </td>
                                    )}

                                </tr>

                            ))}

                    </tbody>

                </table>

            </div>

        </div>
    )

}
