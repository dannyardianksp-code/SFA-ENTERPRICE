'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useRouter
} from 'next/navigation'

export default function CustomersPage() {

    const [customers, setCustomers] =
        useState<any[]>([])

    const [search, setSearch] =
        useState<string>('')

    const [userLocation, setUserLocation] =
        useState<any>(null)

    const router = useRouter()

    // ==================================================
    // GET USER GPS
    // ==================================================

    useEffect(() => {

        navigator.geolocation.getCurrentPosition(

            (pos) => {

                setUserLocation({

                    latitude:
                        pos.coords.latitude,

                    longitude:
                        pos.coords.longitude

                })

            }

        )

    }, [])

    // ==================================================
    // LOAD CUSTOMERS
    // ==================================================

    useEffect(() => {

        const fetchCustomers = async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res = await fetch(
                'http://localhost:1000/api/customers',
                {
                    headers: {
                        Authorization:
                            `Bearer ${token}`
                    }
                }
            )

            const data =
                await res.json()

            // HITUNG JARAK
            const mapped =
                data.map((c: any) => {

                    let distance = 0

                    if (
                        userLocation &&
                        c.latitude &&
                        c.longitude
                    ) {

                        distance =
                            getDistanceFromLatLonInKm(

                                userLocation.latitude,
                                userLocation.longitude,

                                parseFloat(c.latitude),
                                parseFloat(c.longitude)

                            )

                    }

                    return {

                        ...c,

                        distance

                    }

                })

            // SORT NEAREST
            mapped.sort(
                (a: any, b: any) =>
                    a.distance - b.distance
            )

            setCustomers(mapped)

        }

        if (userLocation) {

            fetchCustomers()

        }

    }, [userLocation])

    // ==================================================
    // DISTANCE FUNCTION
    // ==================================================

    const getDistanceFromLatLonInKm = (
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ) => {

        const R = 6371

        const dLat =
            deg2rad(lat2 - lat1)

        const dLon =
            deg2rad(lon2 - lon1)

        const a =

            Math.sin(dLat / 2) *
            Math.sin(dLat / 2)

            +

            Math.cos(
                deg2rad(lat1)
            )

            *

            Math.cos(
                deg2rad(lat2)
            )

            *

            Math.sin(dLon / 2)

            *

            Math.sin(dLon / 2)

        const c =
            2 * Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            )

        return R * c

    }

    const deg2rad = (deg: number) => {

        return deg * (
            Math.PI / 180
        )

    }

    // ==================================================
    // CHECK-IN
    // ==================================================

    const handleCheckIn = (
        customerId: number,
        visitPlandId: number
    ) => {

        navigator.geolocation.getCurrentPosition(

            async (pos) => {

                const token =
                    localStorage.getItem(
                        'token'
                    )

                const res = await fetch(
                    'http://localhost:1000/api/visits/checkin',
                    {

                        method: 'POST',

                        headers: {

                            'Content-Type':
                                'application/json',

                            Authorization:
                                `Bearer ${token}`

                        },

                        body: JSON.stringify({

                            customer_id:
                                customerId,

                            // visit_plan_id:
                            //     visitPlanId,

                            latitude:
                                pos.coords.latitude,

                            longitude:
                                pos.coords.longitude

                        })

                    }
                )

                const data =
                    await res.json()

                // ERROR
                if (!res.ok) {

                    alert(data.message)

                    return

                }
                console.log(
                    data.data.id
                )

                window.location.href =
                    `/visit-detail/${data.data.id}`

            }

        )

    }

    // ==================================================
    // UI
    // ==================================================

    const PAGE_SIZE = 10
    const [page, setPage] = useState(1)

    const filteredCustomers = customers.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
    )

    const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE))
    const halamanAman = Math.min(page, totalPages)
    const customersHalamanIni = filteredCustomers.slice(
        (halamanAman - 1) * PAGE_SIZE,
        halamanAman * PAGE_SIZE
    )

    return (

        <div className="p-6">

            {/* HEADER */}

            <div className="mb-8">

                <h1 className="text-4xl font-bold text-black">

                    🏪 Master Customer

                </h1>

                <p className="text-black-400 mt-2">

                    {/* Kelola seluruh customer dan lokasi toko */}

                </p>

            </div>

            {/* KPI */}

            <div className="grid md:grid-cols-3 gap-4 mb-8">

                <div className="bg-white rounded-3xl p-6 shadow-lg">

                    <p className="text-gray-500">

                        Total Customer

                    </p>

                    <h2 className="text-3xl font-bold">

                        {customers.length}

                    </h2>

                </div>

                <div className="bg-white rounded-3xl p-6 shadow-lg">

                    <p className="text-gray-500">

                        Nearby Customer

                    </p>

                    <h2 className="text-3xl font-bold">

                        {

                            customers.filter(

                                c => c.distance < 5

                            ).length

                        }

                    </h2>

                </div>

                <div className="bg-white rounded-3xl p-6 shadow-lg">

                    <p className="text-gray-500">

                        Area Covered

                    </p>

                    <h2 className="text-3xl font-bold">

                        {

                            new Set(

                                customers.map(

                                    c => c.Area?.code

                                )

                            ).size

                        }

                    </h2>

                </div>

            </div>

            {/* ACTION */}

            <div className="flex flex-col md:flex-row gap-4 mb-8">

                <input

                    type="text"

                    placeholder="🔍 Cari toko..."

                    value={search}

                    onChange={(e) =>

                        setSearch(

                            e.target.value

                        )

                    }

                    className="

        flex-1

        bg-white

        rounded-2xl

        p-4

        shadow

      "

                />

                <button

                    onClick={() =>

                        router.push(

                            '/customers/create'

                        )

                    }

                    className="

        bg-blue-600

        hover:bg-blue-700

        text-white

        px-6

        rounded-2xl

      "

                >

                    + Add Customer

                </button>

            </div>

            {/* CUSTOMER LIST */}

            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                <table className="w-full text-left">

                    <thead className="bg-slate-50 border-b border-slate-200">

                        <tr>

                            <th className="p-4 text-sm font-semibold text-slate-500">Toko</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Code</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Area</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Distance</th>
                            <th className="p-4 text-sm font-semibold text-slate-500">Aksi</th>

                        </tr>

                    </thead>

                    <tbody>

                        {customersHalamanIni.map((c: any) => (

                            <tr
                                key={c.id}
                                className="border-b border-slate-100 hover:bg-slate-50"
                            >

                                <td className="p-4 font-semibold text-slate-900">
                                    🏪 {c.name}
                                </td>

                                <td className="p-4 text-slate-600">
                                    {c.code}
                                </td>

                                <td className="p-4 text-slate-600">
                                    {c.Area?.code || '-'}
                                </td>

                                <td className="p-4 text-slate-600">
                                    {c.distance ? `${c.distance.toFixed(2)} km` : '-'}
                                </td>

                                <td className="p-4">

                                    <div className="flex gap-2">

                                        <button

                                            onClick={() =>
                                                window.open(
                                                    `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`,
                                                    '_blank'
                                                )
                                            }

                                            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-xl text-sm"

                                        >
                                            🧭 Navigate
                                        </button>

                                        <button
                                            onClick={() => router.push(`/customers/edit/${c.id}`)}
                                            className="bg-blue-600 text-white px-3 py-2 rounded-xl text-sm"
                                        >
                                            ✏ Edit
                                        </button>

                                    </div>

                                </td>

                            </tr>

                        ))}

                    </tbody>

                </table>

                {totalPages > 1 && (
                    <div className="flex items-center justify-between p-4 border-t border-slate-200">

                        <span className="text-sm text-slate-500">
                            Halaman {halamanAman} dari {totalPages} ({filteredCustomers.length} customer)
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