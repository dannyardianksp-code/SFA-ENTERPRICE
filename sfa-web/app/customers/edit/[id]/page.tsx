'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function EditCustomerPage() {

    const params = useParams()
    const router = useRouter()

    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [saving, setSaving] = useState(false)

    const [customer, setCustomer] = useState<any>(null)

    const [form, setForm] = useState({
        name: '',
        address: '',
        owner_name: '',
        phone: ''
    })

    useEffect(() => {

        const load = async () => {

            const token = localStorage.getItem('token')

            const res = await fetch(`http://localhost:1000/api/customers/${params.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (!res.ok) {
                setNotFound(true)
                setLoading(false)
                return
            }

            const data = await res.json()

            setCustomer(data)

            setForm({
                name: data.name || '',
                address: data.address || '',
                owner_name: data.owner_name || '',
                phone: data.phone || ''
            })

            setLoading(false)

        }

        if (params.id) {
            load()
        }

    }, [params.id])

    const handleChange = (e: any) => {
        setForm({ ...form, [e.target.name]: e.target.value })
    }

    const handleSubmit = async (e: any) => {

        e.preventDefault()

        setSaving(true)

        const token = localStorage.getItem('token')

        // Cuma field editable yang dikirim -- code/area_id/channel_id/
        // customer_group_id dikunci di backend (kode customer dibentuk
        // dari situ), mengirimnya sekalipun tidak berubah cukup rawan
        // salah ketik nilai jadi beda dan ditolak backend.
        const res = await fetch(`http://localhost:1000/api/customers/${params.id}`, {

            method: 'PUT',

            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },

            body: JSON.stringify(form)

        })

        const data = await res.json()

        setSaving(false)

        if (!res.ok) {
            alert(data.message || 'Gagal mengubah customer')
            return
        }

        router.push('/customers')

    }

    if (loading) {
        return (
            <div className="max-w-5xl mx-auto p-6">
                <div className="bg-white rounded-3xl shadow-xl p-8">
                    Loading...
                </div>
            </div>
        )
    }

    if (notFound) {
        return (
            <div className="max-w-5xl mx-auto p-6">
                <div className="bg-white rounded-3xl shadow-xl p-8">
                    <p className="text-slate-500">Customer tidak ditemukan.</p>
                    <button
                        onClick={() => router.push('/customers')}
                        className="mt-4 border border-slate-300 px-4 py-2 rounded-xl"
                    >
                        Kembali
                    </button>
                </div>
            </div>
        )
    }

    return (

        <div className="max-w-5xl mx-auto p-6">

            {/* HEADER */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-black">
                    ✏️ Edit Customer
                </h1>
                <p className="text-black-400 mt-2">
                    {customer.code} -- {customer.name}
                </p>
            </div>

            <form onSubmit={handleSubmit}>

                <div className="bg-white rounded-3xl shadow-xl p-8">

                    {/* LOCKED INFO */}
                    <h2 className="text-xl font-bold mb-5">
                        Business Information (tidak bisa diubah)
                    </h2>

                    <div className="grid md:grid-cols-3 gap-5 mb-10">

                        <div>
                            <label className="font-medium">Customer Group</label>
                            <div className="w-full border rounded-2xl px-4 py-3 mt-2 bg-slate-50 text-slate-500">
                                {customer.CustomerGroup?.name || '-'}
                            </div>
                        </div>

                        <div>
                            <label className="font-medium">Area</label>
                            <div className="w-full border rounded-2xl px-4 py-3 mt-2 bg-slate-50 text-slate-500">
                                {customer.Area?.name || '-'}
                            </div>
                        </div>

                        <div>
                            <label className="font-medium">Channel</label>
                            <div className="w-full border rounded-2xl px-4 py-3 mt-2 bg-slate-50 text-slate-500">
                                {customer.Channel?.name || '-'}
                            </div>
                        </div>

                    </div>

                    {/* EDITABLE INFO */}
                    <h2 className="text-xl font-bold mb-5">
                        Customer Information
                    </h2>

                    <div className="grid md:grid-cols-2 gap-5">

                        <div>
                            <label className="font-medium">Code</label>
                            <div className="w-full border rounded-2xl px-4 py-3 mt-2 bg-slate-50 text-slate-500">
                                {customer.code}
                            </div>
                        </div>

                        <div>
                            <label className="font-medium">Phone</label>
                            <input
                                name="phone"
                                value={form.phone}
                                onChange={handleChange}
                                className="w-full border rounded-2xl px-4 py-3 mt-2"
                            />
                        </div>

                    </div>

                    <div className="mt-5">
                        <label className="font-medium">Nama Toko</label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            className="w-full border rounded-2xl px-4 py-3 mt-2"
                        />
                    </div>

                    <div className="mt-5">
                        <label className="font-medium">Nama Pemilik</label>
                        <input
                            name="owner_name"
                            value={form.owner_name}
                            onChange={handleChange}
                            className="w-full border rounded-2xl px-4 py-3 mt-2"
                        />
                    </div>

                    <div className="mt-5">
                        <label className="font-medium">Alamat</label>
                        <textarea
                            name="address"
                            value={form.address}
                            onChange={handleChange}
                            rows={4}
                            className="w-full border rounded-2xl px-4 py-3 mt-2"
                        />
                    </div>

                    {/* SAVE */}
                    <div className="mt-10 flex justify-end gap-3">

                        <button
                            type="button"
                            onClick={() => router.push('/customers')}
                            className="border border-slate-300 px-8 py-4 rounded-2xl font-semibold"
                        >
                            Batal
                        </button>

                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-8 py-4 rounded-2xl font-semibold"
                        >
                            {saving ? 'Menyimpan...' : 'Save Customer'}
                        </button>

                    </div>

                </div>

            </form>

        </div>

    )

}
