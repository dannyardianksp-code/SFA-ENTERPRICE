'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { API_BASE_URL } from '@/app/utils/api-config'

export default function EditVisitPlanPage() {

    const params = useParams()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [saving, setSaving] = useState(false)

    const [customers, setCustomers] = useState<any[]>([])

    const [plan, setPlan] = useState<any>(null)

    const [customerId, setCustomerId] = useState('')
    const [visitDate, setVisitDate] = useState('')

    useEffect(() => {

        const load = async () => {

            const token = localStorage.getItem('token')

            const [cRes, pRes] = await Promise.all([

                fetch(`${API_BASE_URL}/customers`, {
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
            const pData = await pRes.json()

            setCustomers(Array.isArray(cData) ? cData : [])

            const found = Array.isArray(pData)
                ? pData.find((p: any) => String(p.id) === String(params.id))
                : null

            if (!found) {
                setNotFound(true)
                setLoading(false)
                return
            }

            setPlan(found)
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

                            <div className="w-full border rounded-xl p-3 mt-2 bg-slate-50 text-slate-500">
                                {plan.User?.name}
                            </div>

                            <p className="text-xs text-slate-400 mt-1">
                                Sales tidak bisa diubah. Hapus rencana ini lalu buat yang baru.
                            </p>

                        </div>

                        <div>

                            <label className="font-semibold">
                                Toko
                            </label>

                            <select
                                className="w-full border rounded-xl p-3 mt-2"
                                value={customerId}
                                onChange={(e) => setCustomerId(e.target.value)}
                            >

                                {customers.map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}

                            </select>

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
