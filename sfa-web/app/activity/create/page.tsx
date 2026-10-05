'use client'

import { useEffect, useState } from 'react'
import { API_BASE_URL } from '@/app/utils/api-config'

type FieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'DROPDOWN' | 'PHOTO'

type FieldDef = {
    id?: number
    label: string
    field_type: FieldType
    options: string[] | null
    required: boolean
}

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
    TEXT: 'Teks',
    NUMBER: 'Angka',
    DATE: 'Tanggal',
    DROPDOWN: 'Dropdown',
    PHOTO: 'Foto',
}

export default function MasterActivitiesPage() {

    const [activities, setActivities] = useState<any[]>([])
    const [channels, setChannels] = useState<any[]>([])
    const [search, setSearch] = useState('')

    // ======================
    // FIELD BUILDER
    // ======================
    const [fieldModalActivity, setFieldModalActivity] = useState<any>(null)
    const [fieldList, setFieldList] = useState<FieldDef[]>([])
    const [fieldLoading, setFieldLoading] = useState(false)
    const [fieldSaving, setFieldSaving] = useState(false)

    const [newFieldLabel, setNewFieldLabel] = useState('')
    const [newFieldType, setNewFieldType] = useState<FieldType>('TEXT')
    const [newFieldOptions, setNewFieldOptions] = useState('')
    const [newFieldRequired, setNewFieldRequired] = useState(true)

    const openFieldBuilder = async (activity: any) => {

        setFieldModalActivity(activity)
        setFieldLoading(true)

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/activities/${activity.id}/fields`, {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        setFieldList(
            Array.isArray(data)
                ? data
                    .slice()
                    .sort((a: any, b: any) => a.display_order - b.display_order)
                    .map((f: any) => ({ id: f.id, label: f.label, field_type: f.field_type, options: f.options, required: f.required }))
                : []
        )

        setFieldLoading(false)

    }

    const closeFieldBuilder = () => {
        setFieldModalActivity(null)
        setFieldList([])
        setNewFieldLabel('')
        setNewFieldType('TEXT')
        setNewFieldOptions('')
        setNewFieldRequired(true)
    }

    const addFieldToList = () => {

        if (!newFieldLabel.trim()) return

        const field: FieldDef = {
            label: newFieldLabel.trim(),
            field_type: newFieldType,
            required: newFieldRequired,
            options: newFieldType === 'DROPDOWN'
                ? newFieldOptions.split(',').map(s => s.trim()).filter(Boolean)
                : null,
        }

        setFieldList(prev => [...prev, field])
        setNewFieldLabel('')
        setNewFieldType('TEXT')
        setNewFieldOptions('')
        setNewFieldRequired(true)

    }

    const removeFieldFromList = (index: number) => {
        setFieldList(prev => prev.filter((_, i) => i !== index))
    }

    const toggleFieldRequired = (index: number) => {
        setFieldList(prev => prev.map((f, i) => i === index ? { ...f, required: !f.required } : f))
    }

    const saveFieldList = async () => {

        setFieldSaving(true)

        const token = localStorage.getItem('token')

        const res = await fetch(`${API_BASE_URL}/activities/${fieldModalActivity.id}/fields`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                fields: fieldList.map(f => ({
                    label: f.label,
                    field_type: f.field_type,
                    options: f.options,
                    required: f.required,
                }))
            })
        })

        setFieldSaving(false)

        if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            alert(err.message || 'Gagal menyimpan field')
            return
        }

        closeFieldBuilder()

    }

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
                                        onClick={() => openFieldBuilder(a)}
                                        className="bg-indigo-50 text-indigo-700 border border-indigo-200 py-2 px-3 rounded-xl font-semibold text-sm"
                                    >
                                        ⚙️ Atur Field
                                    </button>
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

            {/* FIELD BUILDER MODAL */}
            {fieldModalActivity && (
                <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">

                        <div className="flex items-center justify-between p-5 border-b border-slate-200">
                            <div>
                                <h3 className="font-bold text-slate-900 text-lg">Atur Field</h3>
                                <p className="text-sm text-slate-500">{fieldModalActivity.name}</p>
                            </div>
                            <button onClick={closeFieldBuilder} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
                        </div>

                        <div className="p-5">

                            {fieldLoading ? (
                                <p className="text-slate-400 text-sm">Memuat...</p>
                            ) : (
                                <>
                                    <div className="flex flex-col gap-2 mb-5">
                                        {fieldList.length === 0 && (
                                            <p className="text-sm text-slate-400">Belum ada field. Tambah di bawah.</p>
                                        )}
                                        {fieldList.map((f, i) => (
                                            <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm text-slate-900">{f.label}</div>
                                                    <div className="flex gap-2 mt-1 items-center flex-wrap">
                                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                                                            {FIELD_TYPE_LABEL[f.field_type]}
                                                        </span>
                                                        <span className="text-[11px] text-slate-400">{f.required ? 'Wajib' : 'Opsional'}</span>
                                                        {f.options && (
                                                            <span className="text-[11px] text-slate-400">Pilihan: {f.options.join(', ')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleFieldRequired(i)}
                                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-sm"
                                                    title="Toggle wajib"
                                                >
                                                    {f.required ? '✓' : '○'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => removeFieldFromList(i)}
                                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-red-600 text-sm"
                                                    title="Hapus"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="border-1.5 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col gap-3" style={{ borderStyle: 'dashed', borderWidth: 1.5 }}>
                                        <div className="flex gap-2 flex-wrap">
                                            <input
                                                type="text"
                                                placeholder="Label field, mis. Nama Produk"
                                                value={newFieldLabel}
                                                onChange={(e) => setNewFieldLabel(e.target.value)}
                                                className="flex-1 min-w-[140px] border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            />
                                            <select
                                                value={newFieldType}
                                                onChange={(e) => setNewFieldType(e.target.value as FieldType)}
                                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            >
                                                {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => (
                                                    <option key={value} value={value}>{label}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {newFieldType === 'DROPDOWN' && (
                                            <input
                                                type="text"
                                                placeholder="Pilihan dropdown, pisah koma: A, B, C"
                                                value={newFieldOptions}
                                                onChange={(e) => setNewFieldOptions(e.target.value)}
                                                className="border border-slate-200 rounded-lg px-3 py-2 text-sm"
                                            />
                                        )}

                                        <label className="flex items-center gap-2 text-sm text-slate-600">
                                            <input
                                                type="checkbox"
                                                checked={newFieldRequired}
                                                onChange={(e) => setNewFieldRequired(e.target.checked)}
                                            />
                                            Wajib diisi
                                        </label>

                                        <button
                                            type="button"
                                            onClick={addFieldToList}
                                            className="self-start bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                                        >
                                            + Tambah Field
                                        </button>
                                    </div>
                                </>
                            )}

                        </div>

                        <div className="flex justify-end gap-2 p-5 border-t border-slate-200 bg-slate-50">
                            <button onClick={closeFieldBuilder} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600">
                                Batal
                            </button>
                            <button
                                onClick={saveFieldList}
                                disabled={fieldSaving || fieldLoading}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold"
                            >
                                {fieldSaving ? 'Menyimpan...' : 'Simpan Field'}
                            </button>
                        </div>

                    </div>
                </div>
            )}

        </div>
    )
}
