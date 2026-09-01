'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const LiveTrackingMap = dynamic(() => import('../components/LiveTrackingMap'), {
    ssr: false
})

// Near-live -- mobile ngirim ping tiap 2 menit selama app kebuka, web
// ini polling tiap 30 detik. Bukan live ketat (detik-ke-detik).
const POLL_MS = 30 * 1000

// Duplikat kecil dari LiveTrackingMap.tsx (bukan di-import) -- file itu
// dibungkus dynamic({ ssr:false }) karena leaflet, jadi helper murni ini
// sengaja tidak ikut lewat jalur yang sama supaya tidak menyeret modul
// leaflet ke evaluasi SSR halaman ini.
const formatUmur = (updatedAt: string): string => {

    const detik = Math.max(
        0,
        Math.floor((Date.now() - new Date(updatedAt).getTime()) / 1000)
    )

    if (detik < 60) return 'baru saja'
    if (detik < 3600) return `${Math.floor(detik / 60)} menit lalu`
    if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`

    return `${Math.floor(detik / 86400)} hari lalu`

}

const SEGAR_DETIK = 5 * 60

export default function LiveTrackingPage() {

    const [locations, setLocations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [lastFetch, setLastFetch] = useState<Date | null>(null)

    // ts selalu beda tiap klik -- referensi object baru, jadi efek di
    // LiveTrackingMap tetap kepicu walau baris yang sama diklik dua kali
    // berturut-turut (userId doang gak akan berubah kalau diklik ulang).
    const [focusRequest, setFocusRequest] =
        useState<{ userId: number; ts: number } | null>(null)

    const fokusKe = (userId: number) => {
        setFocusRequest({ userId, ts: Date.now() })
        document.getElementById('live-tracking-map')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }

    const fetchLocations = async () => {

        const token = localStorage.getItem('token')

        const res = await fetch('http://localhost:1000/api/user-locations', {
            headers: { Authorization: `Bearer ${token}` }
        })

        const data = await res.json()

        setLocations(Array.isArray(data) ? data : [])
        setLastFetch(new Date())
        setLoading(false)

    }

    useEffect(() => {

        fetchLocations()

        const interval = setInterval(fetchLocations, POLL_MS)

        return () => clearInterval(interval)

    }, [])

    return (
        <div className="p-6 space-y-6 bg-slate-50 min-h-screen">

            {/* HEADER */}
            <div className="bg-white rounded-3xl p-6 shadow-lg flex justify-between items-center">

                <div>
                    <h1 className="text-3xl font-bold text-slate-900">
                        🛰️ Live Tracking
                    </h1>
                    <p className="text-slate-500 mt-1">
                        Posisi terakhir tim -- near-live, update tiap kali mobile
                        kirim ping (app kebuka), bukan detik-ke-detik.
                    </p>
                </div>

                {lastFetch && (
                    <span className="text-sm text-slate-400">
                        Terakhir refresh: {lastFetch.toLocaleTimeString('id-ID')}
                    </span>
                )}

            </div>

            {/* LEGEND */}
            <div className="bg-white rounded-3xl p-4 shadow flex gap-6 items-center text-sm text-slate-600">
                <span>🟢 Update &lt; 5 menit lalu</span>
                <span>⚪ Lebih lama</span>
                <span className="ml-auto text-slate-400">
                    {locations.length} user
                </span>
            </div>

            {/* MAP */}
            <div
                id="live-tracking-map"
                className="bg-white rounded-3xl shadow-lg overflow-hidden"
            >

                {loading ? (
                    <div className="p-10 text-center text-slate-400">
                        Memuat...
                    </div>
                ) : locations.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        Belum ada posisi terkirim.
                    </div>
                ) : (
                    <LiveTrackingMap
                        locations={locations}
                        focusRequest={focusRequest}
                    />
                )}

            </div>

            {/* LIST */}
            {!loading && locations.length > 0 && (

                <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                    <table className="w-full text-left">

                        <thead className="bg-slate-50 border-b border-slate-200">

                            <tr>
                                <th className="p-4 text-sm font-semibold text-slate-500">Nama</th>
                                <th className="p-4 text-sm font-semibold text-slate-500">Role</th>
                                <th className="p-4 text-sm font-semibold text-slate-500">Area Cover</th>
                                <th className="p-4 text-sm font-semibold text-slate-500">Update</th>
                            </tr>

                        </thead>

                        <tbody>

                            {locations.map((loc: any) => {

                                const segar =
                                    (Date.now() - new Date(loc.updated_at).getTime()) / 1000
                                    < SEGAR_DETIK

                                const areaCover =
                                    loc.User?.AssignedAreas?.length > 0
                                        ? loc.User.AssignedAreas.map((a: any) => a.code).join(', ')
                                        : '-'

                                return (
                                    <tr
                                        key={loc.user_id}
                                        onClick={() => fokusKe(loc.user_id)}
                                        className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                                    >

                                        <td className="p-4 font-semibold text-slate-900">
                                            {segar ? '🟢' : '⚪'} {loc.User?.name}
                                        </td>

                                        <td className="p-4 text-slate-600">
                                            {loc.User?.role}
                                        </td>

                                        <td className="p-4 text-slate-600">
                                            {areaCover}
                                        </td>

                                        <td className="p-4 text-slate-500 text-sm">
                                            {formatUmur(loc.updated_at)}
                                        </td>

                                    </tr>
                                )

                            })}

                        </tbody>

                    </table>

                </div>

            )}

        </div>
    )

}
