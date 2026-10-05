'use client'

import {
    useEffect,
    useState
} from 'react'

import {
    useParams,
    useRouter
} from 'next/navigation'

import { API_BASE_URL, UPLOADS_ORIGIN } from '@/app/utils/api-config'

export default function VisitDetailPage() {

    const params = useParams()

    const router = useRouter()

    const [activities, setActivities] =
        useState<any[]>([])


    const [visit, setVisit] =
        useState<any>(null)

    const [role, setRole] =
        useState('')

    useEffect(() => {

        if (params.id) {

            fetchVisit()
            fetchActivities()

        }

    }, [params.id])

    useEffect(() => {
        setRole(localStorage.getItem('role') || '')
    }, [])

    const fetchActivities =
        async () => {

            const token =
                localStorage.getItem(
                    'token'
                )

            const res = await fetch(

                `${API_BASE_URL}/visit-activities/visit/${params.id}`,

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

            `${API_BASE_URL}/visits/${params.id}`,

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

                `${API_BASE_URL}/visits/${params.id}/checkout`,

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

                        {role === 'ADMINISTRATOR' && (
                            <button
                                onClick={() =>
                                    router.push(`/visits/activity?visit_id=${visit.id}`)
                                }
                                className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl font-semibold"
                            >
                                ➕ Add Activity
                            </button>
                        )}

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

                                <h3 className="font-bold text-slate-900">
                                    {a.Activity?.name || "-"}
                                </h3>

                            </div>

                            <span className="text-xs text-slate-400">
                                Activity #{index + 1}
                            </span>

                        </div>

                        {/* FIELD DINAMIS -- label & tipe dari Activity.FieldDefinitions,
                            nilai dari field_values (dikunci sebagai string oleh JSON,
                            jadi dicocokkan via String(def.id)). Baris lama (sebelum fitur
                            ini) sudah di-backfill ke field_values juga lewat migrasi,
                            jadi satu jalur render ini cukup buat data lama maupun baru. */}
                        <div className="mt-4 space-y-2 text-sm">

                            {(a.Activity?.FieldDefinitions || [])
                                .slice()
                                .sort((x: any, y: any) => x.display_order - y.display_order)
                                .map((def: any) => {

                                    const nilai = a.field_values?.[def.id] ?? a.field_values?.[String(def.id)]

                                    if (def.field_type === 'PHOTO') {
                                        return (
                                            <div key={def.id} className="flex justify-between items-center">
                                                <span className="text-slate-400">{def.label}</span>
                                                {nilai ? (
                                                    <a
                                                        href={`${UPLOADS_ORIGIN}${nilai}`}
                                                        target="_blank"
                                                        className="text-blue-600 font-semibold text-sm"
                                                    >
                                                        📷 View Photo
                                                    </a>
                                                ) : (
                                                    <span className="text-slate-400 text-sm">No Photo</span>
                                                )}
                                            </div>
                                        )
                                    }

                                    return (
                                        <div key={def.id} className="flex justify-between">
                                            <span className="text-slate-400">{def.label}</span>
                                            <span className="font-medium text-slate-900 text-right max-w-[60%]">
                                                {nilai !== undefined && nilai !== null && nilai !== '' ? String(nilai) : '-'}
                                            </span>
                                        </div>
                                    )

                                })}

                        </div>

                    </div>
                ))}

            </div>

        </div>
    );
}