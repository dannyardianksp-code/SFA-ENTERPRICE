'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const LiveTrackingMap = dynamic(() => import('../components/LiveTrackingMap'), {
    ssr: false
})

// Near-live -- mobile ngirim ping tiap 2 menit selama app kebuka, web
// ini polling tiap 30 detik. Bukan live ketat (detik-ke-detik).
const POLL_MS = 30 * 1000

export default function LiveTrackingPage() {

    const [locations, setLocations] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [lastFetch, setLastFetch] = useState<Date | null>(null)

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
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">

                {loading ? (
                    <div className="p-10 text-center text-slate-400">
                        Memuat...
                    </div>
                ) : locations.length === 0 ? (
                    <div className="p-10 text-center text-slate-400">
                        Belum ada posisi terkirim.
                    </div>
                ) : (
                    <LiveTrackingMap locations={locations} />
                )}

            </div>

        </div>
    )

}
