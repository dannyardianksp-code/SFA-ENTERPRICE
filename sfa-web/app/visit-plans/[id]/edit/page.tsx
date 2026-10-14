'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { API_BASE_URL } from '@/app/utils/api-config'

// Combobox toko: klik kotaknya buka panel berisi kolom cari + daftar
// hasil filter -- bukan input cari terpisah di atas <select> biasa,
// supaya cari & pilihnya terasa satu aksi (bukan dua kontrol yang
// terasa tidak sinkron).
function TokoCombobox({
    customers,
    value,
    onChange
}: {
    customers: any[]
    value: string
    onChange: (id: string) => void
}) {

    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState('')
    const wrapRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLInputElement>(null)

    const selected = customers.find((c: any) => String(c.id) === value)

    const filtered = customers.filter((c: any) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    useEffect(() => {

        const onClickOutside = (e: MouseEvent) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', onClickOutside)
        return () => document.removeEventListener('mousedown', onClickOutside)

    }, [])

    const openPanel = () => {
        setSearch('')
        setOpen(true)
        setTimeout(() => searchRef.current?.focus(), 20)
    }

    return (

        <div className="relative" ref={wrapRef}>

            <button
                type="button"
                onClick={() => (open ? setOpen(false) : openPanel())}
                className="w-full border rounded-xl p-3 mt-2 flex items-center justify-between gap-2 text-left bg-white"
            >
                <span className={selected ? '' : 'text-slate-400'}>
                    {selected ? selected.name : 'Pilih toko'}
                </span>
                <span className="text-slate-400 text-xs">▼</span>
            </button>

            {open && (

                <div className="absolute z-10 mt-1 w-full bg-white border rounded-xl shadow-lg overflow-hidden">

                    <div className="flex items-center gap-2 px-3 py-2 border-b">
                        <span className="text-slate-400 text-sm">🔍</span>
                        <input
                            ref={searchRef}
                            type="text"
                            placeholder="Cari nama toko..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 outline-none text-sm"
                        />
                    </div>

                    <div className="max-h-56 overflow-y-auto p-1">

                        {filtered.length === 0 && (
                            <div className="px-3 py-4 text-center text-sm text-slate-400">
                                Tidak ada toko cocok
                            </div>
                        )}

                        {filtered.map((c: any) => (
                            <div
                                key={c.id}
                                onClick={() => { onChange(String(c.id)); setOpen(false) }}
                                className={`px-3 py-2 rounded-lg text-sm cursor-pointer flex items-center justify-between gap-2 hover:bg-blue-50 ${
                                    String(c.id) === value ? 'bg-blue-50 text-blue-600 font-semibold' : ''
                                }`}
                            >
                                <span>{c.name}</span>
                                {String(c.id) === value && <span className="text-blue-600 text-xs">✓</span>}
                            </div>
                        ))}

                    </div>

                </div>

            )}

        </div>

    )

}

export default function EditVisitPlanPage() {

    const params = useParams()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [saving, setSaving] = useState(false)

    const [customers, setCustomers] = useState<any[]>([])
    const [salesUsers, setSalesUsers] = useState<any[]>([])

    const [plan, setPlan] = useState<any>(null)

    const [userId, setUserId] = useState('')
    const [customerId, setCustomerId] = useState('')
    const [visitDate, setVisitDate] = useState('')

    useEffect(() => {

        const load = async () => {

            const token = localStorage.getItem('token')

            const [cRes, uRes, pRes] = await Promise.all([

                fetch(`${API_BASE_URL}/customers?status=ACTIVE`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),

                fetch(`${API_BASE_URL}/users`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),

                // Tidak ada GET /api/visit-plans/:id -- ambil daftar
                // penuh dan cari barisnya sendiri, sama seperti halaman
                // daftar mengambil datanya.
                fetch(`${API_BASE_URL}/visit-plans`, {
                    headers: { Authorization: `Bearer ${token}` }
                })

            ])

            const cData = await cRes.json()
            const uData = await uRes.json()
            const pData = await pRes.json()

            setCustomers(Array.isArray(cData) ? cData : [])
            setSalesUsers(Array.isArray(uData) ? uData : [])

            const found = Array.isArray(pData)
                ? pData.find((p: any) => String(p.id) === String(params.id))
                : null

            if (!found) {
                setNotFound(true)
                setLoading(false)
                return
            }

            setPlan(found)
            setUserId(String(found.user_id))
            setCustomerId(String(found.customer_id))
            setVisitDate(found.visit_date?.slice(0, 10) || '')
            setLoading(false)

        }

        if (params.id) {
            load()
        }

    }, [params.id])

    const handleSubmit = async (e: any) => {

        e.preventDefault()

        setSaving(true)

        const token = localStorage.getItem('token')

        const res = await fetch(

            `${API_BASE_URL}/visit-plans/${params.id}`,

            {

                method: 'PUT',

                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },

                body: JSON.stringify({
                    user_id: userId,
                    customer_id: customerId,
                    visit_date: visitDate
                })

            }

        )

        setSaving(false)

        if (!res.ok) {

            const err = await res.json().catch(() => ({}))

            alert(err.message || 'Gagal mengubah visit plan')

            return

        }

        router.push('/visit-plans')

    }

    if (loading) {

        return (
            <div className="bg-white rounded-3xl shadow-lg p-6">
                Loading...
            </div>
        )

    }

    if (notFound) {

        return (
            <div className="bg-white rounded-3xl shadow-lg p-6">
                <p className="text-slate-500">
                    Visit plan tidak ditemukan.
                </p>

                <button
                    onClick={() => router.push('/visit-plans')}
                    className="mt-4 border border-slate-300 px-4 py-2 rounded-xl"
                >
                    Kembali
                </button>
            </div>

        )

    }

    if (plan.status !== 'PENDING') {

        return (
            <div className="bg-white rounded-3xl shadow-lg p-6">
                <p className="text-slate-500">
                    Visit plan berstatus {plan.status} tidak bisa diubah.
                </p>

                <button
                    onClick={() => router.push('/visit-plans')}
                    className="mt-4 border border-slate-300 px-4 py-2 rounded-xl"
                >
                    Kembali
                </button>
            </div>

        )

    }

    return (

        <div className="space-y-6">

            <div className="bg-white rounded-3xl p-6 shadow-lg">

                <h1 className="text-3xl font-bold text-slate-900">
                    ✏️ Edit Visit Plan
                </h1>

                <p className="text-slate-500 mt-2">
                    {plan.User?.name}
                </p>

            </div>

            <div className="bg-white rounded-3xl shadow-lg p-6">

                <form onSubmit={handleSubmit}>

                    <div className="grid md:grid-cols-2 gap-4">

                        <div>

                            <label className="font-semibold">
                                Sales
                            </label>

                            <select
                                className="w-full border rounded-xl p-3 mt-2"
                                value={userId}
                                onChange={(e) => setUserId(e.target.value)}
                            >

                                {salesUsers.map((u: any) => (
                                    <option key={u.id} value={u.id}>
                                        {u.name}
                                    </option>
                                ))}

                            </select>

                        </div>

                        <div>

                            <label className="font-semibold">
                                Toko
                            </label>

                            <TokoCombobox
                                customers={customers}
                                value={customerId}
                                onChange={setCustomerId}
                            />

                        </div>

                        <div>

                            <label className="font-semibold">
                                Visit Date
                            </label>

                            <input
                                type="date"
                                value={visitDate}
                                onChange={(e) => setVisitDate(e.target.value)}
                                className="w-full border rounded-xl p-3 mt-2"
                            />

                        </div>

                    </div>

                    <div className="flex gap-3 mt-5">

                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-5 py-3 rounded-xl"
                        >
                            {saving ? 'Menyimpan...' : 'Update Plan'}
                        </button>

                        <button
                            type="button"
                            onClick={() => router.push('/visit-plans')}
                            className="border border-slate-300 px-5 py-3 rounded-xl"
                        >
                            Batal
                        </button>

                    </div>

                </form>

            </div>

        </div>

    )

}
