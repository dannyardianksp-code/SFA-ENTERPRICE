'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useParams,
    useRouter
} from 'next/navigation'

export default function VisitDetailPage() {

    const params = useParams()

    const router = useRouter()

    const [activities, setActivities] =
        useState<any[]>([])


    const [visit, setVisit] =
        useState<any>(null)

    useEffect(() => {

        if (params.id) {

            fetchVisit()
            fetchActivities()

        }

    }, [params.id])

    const fetchActivities =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res = await fetch(

                `http://localhost:1000/api/visit-activities/visit/${params.id}`,

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

        }

    const fetchVisit = async () => {

        const token =
            localStorage.getItem(
                'token'
            )

        const res = await fetch(

            `http://localhost:1000/api/visits/${params.id}`,

            {

                headers: {

                    Authorization:
                        `Bearer ${token}`

                }

            }

        )

        const data =
            await res.json()

        setVisit(data)

    }

    if (!visit) {

        return <div>Loading...</div>

    }
    const handleCheckout =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res = await fetch(

                `http://localhost:1000/api/visits/${params.id}/checkout`,

                {

                    method: 'POST',

                    headers: {

                        Authorization:
                            `Bearer ${token}`

                    }

                }

            )

            const data =
                await res.json()

            alert(data.message)

            fetchVisit()

        }

    const getDuration = () => {

        if (!visit.checkout_time)
            return 'Belum Checkout'

        const checkin =
            new Date(
                visit.checkin_time
            )

        const checkout =
            new Date(
                visit.checkout_time
            )

        const diffMs =
            checkout.getTime() -
            checkin.getTime()

        const minutes =
            Math.floor(
                diffMs / 1000 / 60
            )

        const hours =
            Math.floor(
                minutes / 60
            )

        const remainMinutes =
            minutes % 60

        return `
        ${hours} Jam
        ${remainMinutes} Menit
    `
    }



    return (
        <div className="space-y-6">

            {/* HEADER (same system as VISIT PLAN but richer state) */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">

                <div className="flex justify-between items-start">

                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">
                            📍 Visit Detail
                        </h1>

                        <p className="text-slate-500 mt-2">
                            {visit.Customer?.name}
                        </p>
                    </div>

                    {/* STATUS BADGE (important SFA signal) */}
                    <span className={`
          px-3 py-2 rounded-full text-sm font-semibold
          ${visit.checkout_time ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}
        `}>
                        {visit.checkout_time ? "COMPLETED" : "ON VISIT"}
                    </span>

                </div>

            </div>

            {/* QUICK ACTION BAR (core SFA UX) */}
            {
                !visit.checkout_time && (
                    <div className="bg-white rounded-3xl p-5 shadow-lg flex gap-3">

                        <button
                            onClick={() =>
                                router.push(`/visits/activity?visit_id=${visit.id}`)
                            }
                            className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold"
                        >
                            ➕ Add Activity
                        </button>

                        <button
                            onClick={handleCheckout}
                            className="flex-1 bg-slate-800 text-white px-4 py-3 rounded-xl font-semibold"
                        >
                            🚪 Checkout
                        </button>

                    </div>
                )
            }

            {/* PROGRESS TIMELINE (THIS IS THE GAME CHANGER) */}
            <div className="bg-white rounded-3xl p-6 shadow-lg">

                <h2 className="text-lg font-bold text-slate-900 mb-4">
                    ⏱ Visit Progress
                </h2>

                <div className="space-y-3">

                    <div className="flex justify-between">
                        <span className="text-slate-500">Check In</span>
                        <span className="font-semibold">
                            {new Date(visit.checkin_time).toLocaleString()}
                        </span>
                    </div>

                    <div className="flex justify-between">
                        <span className="text-slate-500">Check Out</span>
                        <span className="font-semibold">
                            {visit.checkout_time
                                ? new Date(visit.checkout_time).toLocaleString()
                                : "In Progress"}
                        </span>
                    </div>

                    <div className="flex justify-between border-t pt-3">
                        <span className="text-slate-500">Duration</span>
                        <span className="font-bold text-slate-900">
                            {getDuration()}
                        </span>
                    </div>

                </div>

            </div>

            {/* ACTIVITY HEADER */}
            <div className="space-y-4">

                {activities.map((a: any, index: number) => (
                    <div
                        key={a.id}
                        className="bg-white rounded-3xl shadow-lg p-5"
                    >

                        {/* HEADER */}
                        <div className="flex justify-between items-start">

                            <div className="flex gap-3 items-start">

                                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold">
                                    {index + 1}
                                </div>

                                <div>
                                    <h3 className="font-bold text-slate-900">
                                        {a.Activity?.name || "-"}
                                    </h3>

                                    <p className="text-slate-500 text-sm">
                                        {a.product_name}
                                    </p>
                                </div>

                            </div>

                            <div className="text-right">
                                <p className="text-slate-400 text-xs">Qty</p>
                                <p className="font-bold text-slate-900">{a.qty}</p>
                            </div>

                        </div>

                        {/* PRICE SECTION (MAIN VALUE) */}
                        <div className="grid grid-cols-2 gap-3 mt-4">

                            <div className="bg-slate-50 rounded-2xl p-3">
                                <p className="text-slate-400 text-xs">Normal Price</p>
                                <p className="font-semibold text-slate-900">
                                    {Number(a.normal_price).toLocaleString("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        minimumFractionDigits: 0
                                    })}
                                </p>
                            </div>

                            <div className="bg-green-50 rounded-2xl p-3">
                                <p className="text-slate-400 text-xs">Promo Price</p>
                                <p className="font-semibold text-green-600">
                                    {Number(a.promo_price).toLocaleString("id-ID", {
                                        style: "currency",
                                        currency: "IDR",
                                        minimumFractionDigits: 0
                                    })}
                                </p>
                            </div>

                        </div>

                        {/* META INFO */}
                        <div className="mt-4 space-y-2 text-sm">

                            {/* expiry */}
                            {a.expired_date && (
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Expired Date</span>
                                    <span className="font-medium text-slate-900">
                                        {new Date(a.expired_date).toLocaleDateString()}
                                    </span>
                                </div>
                            )}

                            {/* notes */}
                            <div className="flex justify-between">
                                <span className="text-slate-400">Notes</span>
                                <span className="font-medium text-slate-900 text-right max-w-[60%]">
                                    {a.notes || "-"}
                                </span>
                            </div>

                        </div>

                        {/* FOOTER ACTION */}
                        <div className="flex justify-between items-center mt-4">

                            {/* photo */}
                            <div>
                                {a.photo_url ? (
                                    <a
                                        href={`http://localhost:1000${a.photo_url}`}
                                        target="_blank"
                                        className="text-blue-600 font-semibold text-sm"
                                    >
                                        📷 View Photo
                                    </a>
                                ) : (
                                    <span className="text-slate-400 text-sm">
                                        No Photo
                                    </span>
                                )}
                            </div>

                            {/* optional badge (can extend later) */}
                            <span className="text-xs text-slate-400">
                                Activity #{index + 1}
                            </span>

                        </div>

                    </div>
                ))}

            </div>

        </div>
    );
}