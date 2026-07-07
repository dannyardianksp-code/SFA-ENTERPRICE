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

            <div

                className="

      grid

      md:grid-cols-2

      xl:grid-cols-3

      gap-5

    "

            >

                {

                    customers

                        .filter(c =>

                            c.name

                                .toLowerCase()

                                .includes(

                                    search.toLowerCase()

                                )

                        )

                        .map((c: any) => (

                            <div

                                key={c.id}

                                className="

            bg-white

            rounded-3xl

            p-6

            shadow-lg

            hover:shadow-2xl

            hover:-translate-y-1

            transition-all

          "

                            >

                                <h2 className="text-xl font-bold">

                                    🏪 {c.name}

                                </h2>

                                <div className="mt-4 space-y-2">

                                    <p>

                                        <strong>

                                            Code :

                                        </strong>

                                        {c.code}

                                    </p>

                                    <p>

                                        <strong>

                                            Area :

                                        </strong>

                                        {c.Area?.code || '-'}

                                    </p>

                                    <p>

                                        <strong>

                                            Distance :

                                        </strong>

                                        {

                                            c.distance

                                                ?

                                                `${c.distance.toFixed(2)} km`

                                                :

                                                '-'

                                        }

                                    </p>

                                </div>

                                <div className="flex gap-2 mt-5">


                                    <button

                                        onClick={() =>
                                            window.open(
                                                `https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}`,
                                                '_blank'
                                            )
                                        }

                                        className="
      bg-green-600
      hover:bg-green-700
      text-white
      px-3
      py-2
      rounded-xl
      text-sm
    "

                                    >

                                        🧭 Navigate

                                    </button>

                                    <button

                                        className="

                bg-blue-600

                text-white

                px-4

                py-2

                rounded-xl

              "

                                    >

                                        ✏ Edit

                                    </button>

                                </div>

                            </div>

                        ))

                }

            </div>

        </div>

    )

}