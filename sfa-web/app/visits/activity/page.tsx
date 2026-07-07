'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useRouter,
    useSearchParams
} from 'next/navigation'

import { useRef } from "react";



export default function VisitActivityPage() {

    const router =
        useRouter()

    const params =
        useSearchParams()

    const visit_id =
        params.get('visit_id')

    // ======================
    // STATE
    // ======================

    const [activities, setActivities] =
        useState<any[]>([])

    const [products, setProducts] =
        useState<any[]>([])

    const [photo, setPhoto] =
        useState<any>(null)

    const cameraRef = useRef<HTMLInputElement | null>(null);

    const [form, setForm] =
        useState({

            visit_id:
                visit_id || '',

            activity_id: '',

            product_name: '',

            qty: '',

            expired_date: '',

            normal_price: '',

            promo_price: '',

            notes: ''

        })

    // ======================
    // LOAD MASTER DATA
    // ======================

    useEffect(() => {

        if (!visit_id) return

        fetchProducts()

        fetchActivities()

    }, [visit_id])

    // ======================
    // FETCH PRODUCTS
    // ======================

    const fetchProducts =
        async () => {

            try {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                const res =
                    await fetch(

                        `http://localhost:1000/api/visits/${visit_id}/products`,

                        {

                            headers: {

                                Authorization:
                                    `Bearer ${token}`

                            }

                        }

                    )

                const data =
                    await res.json()


                setProducts(

                    Array.isArray(data)
                        ? data
                        : []

                )

            } catch (err) {

                console.log(err)

            }

        }

    // ======================
    // FETCH ACTIVITIES
    // ======================

    const fetchActivities =
        async () => {

            try {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                const res =
                    await fetch(

                        'http://localhost:1000/api/activities',

                        {

                            headers: {

                                Authorization:
                                    `Bearer ${token}`

                            }

                        }

                    )

                const data =
                    await res.json()



                setActivities(

                    Array.isArray(data)
                        ? data
                        : []

                )

            } catch (err) {

                console.log(err)

            }

        }




    // ======================
    // HANDLE CHANGE
    // ======================

    const handleChange =
        (e: any) => {

            setForm({

                ...form,

                [e.target.name]:
                    e.target.value

            })

        }

    // ======================
    // SUBMIT
    // ======================

    const handleSubmit =
        async (e: any) => {

            e.preventDefault()

            try {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                const formData =
                    new FormData()

                Object.entries(form).forEach(

                    ([key, value]) => {

                        formData.append(
                            key,
                            value as string
                        )

                    }

                )

                if (photo) {

                    formData.append(
                        'photo',
                        photo
                    )

                }

                const res =
                    await fetch(

                        'http://localhost:1000/api/visit-activities',

                        {

                            method: 'POST',

                            headers: {

                                Authorization:
                                    `Bearer ${token}`

                            },

                            body: formData

                        }

                    )

                const data =
                    await res.json()

                // ERROR
                if (!res.ok) {

                    alert(

                        data.message ||

                        'Gagal save activity'

                    )

                    return

                }

                // SUCCESS
                alert(
                    'Activity berhasil disimpan'
                )

                router.replace(
                    `/visit-detail/${visit_id}`
                )

            } catch (err) {

                console.log(err)

                alert(
                    'Terjadi kesalahan'
                )

            }

        }

    // ======================
    // UI
    // ======================

    return (
        <div className="space-y-6 max-w-3xl mx-auto p-6">

            {/* HEADER (same system as other pages) */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">
                <h1 className="text-3xl font-bold text-slate-900">
                    📸 Visit Activity
                </h1>
                <p className="text-slate-500 mt-2">
                    Capture activity selama kunjungan
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

                {/* VISIT CONTEXT (mini info, bukan form utama) */}
                <div className="bg-white rounded-3xl p-5 shadow-lg">
                    <p className="text-slate-500 text-sm">Visit ID</p>
                    <p className="font-bold text-slate-900">{form.visit_id}</p>
                </div>

                {/* CAMERA FIRST (IMPORTANT UX SHIFT) */}
                <div className="bg-white rounded-3xl p-6 shadow-lg text-center">

                    <h2 className="font-bold text-slate-900 mb-3">
                        📷 Product Photo
                    </h2>

                    <input
                        ref={cameraRef}
                        id="cameraInput"
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e: any) => setPhoto(e.target.files[0])}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={() => cameraRef.current?.click()}
                        className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold"
                    >
                        Ambil Foto Produk
                    </button>

                    {photo && (
                        <img
                            src={URL.createObjectURL(photo)}
                            className="mt-4 rounded-2xl w-full object-cover"
                        />
                    )}

                </div>

                {/* CONTEXT BLOCK (Activity + Product) */}
                <div className="bg-white rounded-3xl p-5 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        🛒 Activity Context
                    </h2>

                    {/* ACTIVITY */}
                    <div>
                        <label className="text-slate-500 text-sm">Activity</label>

                        <select
                            name="activity_id"
                            value={form.activity_id}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        >
                            <option value="">Pilih Activity</option>
                            {activities.map((a: any) => (
                                <option key={a.id} value={a.id}>
                                    {a.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* PRODUCT */}
                    <div>
                        <label className="text-slate-500 text-sm">Product</label>

                        <select
                            name="product_name"
                            value={form.product_name}
                            onChange={handleChange}
                            className="w-full mt-2 border rounded-xl p-3"
                        >
                            <option value="">Pilih Product</option>
                            {products.map((p: any) => (
                                <option key={p.id} value={p.name}>
                                    {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                </div>

                {/* TRANSACTION (simplified, not noisy) */}
                <div className="bg-white rounded-3xl p-5 shadow-lg space-y-4">

                    <h2 className="font-bold text-slate-900">
                        💰 Transaction
                    </h2>

                    <div className="grid grid-cols-2 gap-3">

                        <div>
                            <label className="text-slate-500 text-sm">Qty</label>
                            <input
                                type="number"
                                name="qty"
                                value={form.qty}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                        <div>
                            <label className="text-slate-500 text-sm">Expired</label>
                            <input
                                type="date"
                                name="expired_date"
                                value={form.expired_date}
                                onChange={handleChange}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                    </div>

                    {/* PRICE (cleaner grouping) */}
                    <div className="grid grid-cols-2 gap-3">

                        <div>
                            <label className="text-slate-500 text-sm">Normal</label>
                            <input
                                value={
                                    form.normal_price
                                        ? "Rp " + Number(form.normal_price).toLocaleString("id-ID")
                                        : ""
                                }
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "");
                                    setForm({ ...form, normal_price: raw });
                                }}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                        <div>
                            <label className="text-slate-500 text-sm">Promo</label>
                            <input
                                value={
                                    form.promo_price
                                        ? "Rp " + Number(form.promo_price).toLocaleString("id-ID")
                                        : ""
                                }
                                onChange={(e) => {
                                    const raw = e.target.value.replace(/\D/g, "");
                                    setForm({ ...form, promo_price: raw });
                                }}
                                className="w-full mt-2 border rounded-xl p-3"
                            />
                        </div>

                    </div>

                </div>

                {/* NOTES (secondary) */}
                <div className="bg-white rounded-3xl p-5 shadow-lg">
                    <label className="text-slate-500 text-sm">Notes</label>

                    <textarea
                        name="notes"
                        rows={4}
                        value={form.notes}
                        onChange={handleChange}
                        className="w-full mt-2 border rounded-xl p-3"
                    />
                </div>

                {/* CTA */}
                <button
                    type="submit"
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold"
                >
                    Save Activity
                </button>

            </form>

        </div>
    );
}