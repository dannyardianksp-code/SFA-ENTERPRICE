'use client'

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from 'react-leaflet'

import MarkerClusterGroup from 'react-leaflet-cluster'

import { useEffect, useRef } from 'react'

import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

// Marker orang (bukan pin default Leaflet) -- warna badge ikut status
// segar/basi yang sama dengan 🟢/⚪ di popup dan list (page.tsx), supaya
// sekilas lihat peta juga langsung kelihatan mana yang datanya baru.
const buatIkonOrang = (segar: boolean) => L.divIcon({
    className: 'live-tracking-person-icon',
    html: `
        <div style="
            width: 34px;
            height: 34px;
            border-radius: 50%;
            background: ${segar ? '#22c55e' : '#94a3b8'};
            border: 2px solid white;
            box-shadow: 0 1px 4px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            line-height: 1;
        ">🧍</div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -17],
})

function FixMap() {
    const map = useMap()

    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize()
        }, 100)
    }, [map])

    return null
}

// Peta sebelumnya cuma nge-center ke koordinat lokasi PERTAMA di list
// dengan zoom tetap (11) -- kalau user lain (mis. SPG di bawah
// supervisor yang login) posisinya jauh dari titik pertama itu,
// markernya tetap ADA tapi di luar area yang kelihatan di layar,
// seolah-olah tidak muncul sama sekali. Effect ini menyesuaikan
// zoom/posisi peta supaya SEMUA marker yang ada kelihatan sekaligus,
// setiap kali daftar lokasi berubah (bukan cuma sekali saat mount).
function FitAllMarkers({ locations }: any) {
    const map = useMap()

    // Cuma sekali, pas data pertama kali datang -- halaman polling GET
    // tiap 30 detik (page.tsx), dan `locations` jadi array BARU tiap
    // polling walau isinya sama. Kalau effect ini jalan tiap polling,
    // dia bakal nimpa terus posisi yang lagi dilihat user (termasuk
    // hasil klik "fokus ke baris" di FocusOnSelected) tiap 30 detik --
    // mengganggu, bukan membantu.
    const sudahFit = useRef(false)

    useEffect(() => {
        if (sudahFit.current || locations.length === 0) return

        sudahFit.current = true

        if (locations.length === 1) {
            map.setView(
                [
                    parseFloat(locations[0].latitude),
                    parseFloat(locations[0].longitude)
                ],
                14
            )
            return
        }

        const bounds = L.latLngBounds(
            locations.map((loc: any) => [
                parseFloat(loc.latitude),
                parseFloat(loc.longitude)
            ])
        )

        map.fitBounds(bounds, { padding: [50, 50] })

    }, [locations, map])

    return null
}

// Klik baris di list (page.tsx) -- terbangkan map ke titiknya lalu buka
// popup-nya. Zoom 16 (level jalan) dipakai supaya marker-nya lepas dari
// cluster (radius cluster mengecil di zoom tinggi) -- bukan panggil API
// zoomToShowLayer milik react-leaflet-cluster langsung, cukup zoom
// tinggi buat kasus normal (titik antar user jarang sedempet itu).
function FocusOnSelected({ focusRequest, locations, markerRefs }: any) {
    const map = useMap()

    useEffect(() => {
        if (!focusRequest) return

        const loc = locations.find(
            (l: any) => l.user_id === focusRequest.userId
        )

        if (!loc) return

        map.flyTo(
            [parseFloat(loc.latitude), parseFloat(loc.longitude)],
            16,
            { duration: 1 }
        )

        const timer = setTimeout(() => {
            markerRefs.current[focusRequest.userId]?.openPopup()
        }, 1000)

        return () => clearTimeout(timer)

    }, [focusRequest, locations, map, markerRefs])

    return null
}

// Near-live, bukan live ketat -- posisi bisa berumur beberapa menit
// (mobile ngirim tiap 2 menit, cuma pas app kebuka). Ditampilkan
// eksplisit di popup biar admin tahu ini bukan detik-ke-detik.
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

// Segar (<5 menit) ditandai 🟢, lebih lama ⚪ -- indikator kasar biar
// admin langsung tahu mana yang datanya baru vs sudah lumayan basi,
// tanpa perlu custom marker icon per warna.
const SEGAR_DETIK = 5 * 60

export default function LiveTrackingMap({ locations, focusRequest }: any) {

    const markerRefs = useRef<Record<number, L.Marker>>({})

    const center =
        locations.length > 0
            ? [
                parseFloat(locations[0].latitude),
                parseFloat(locations[0].longitude)
            ]
            : [-6.3, 106.9]

    return (
        <MapContainer
            center={center as [number, number]}
            zoom={11}
            scrollWheelZoom={true}
            preferCanvas={true}
            style={{
                height: '600px',
                width: '100%',
                borderRadius: '10px'
            }}
        >

            <FixMap />

            <FitAllMarkers locations={locations} />

            <FocusOnSelected
                focusRequest={focusRequest}
                locations={locations}
                markerRefs={markerRefs}
            />

            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MarkerClusterGroup>

                {locations.map((loc: any) => {

                    const segar =
                        (Date.now() - new Date(loc.updated_at).getTime()) / 1000
                        < SEGAR_DETIK

                    return (
                        <Marker
                            key={loc.user_id}
                            position={[
                                parseFloat(loc.latitude),
                                parseFloat(loc.longitude)
                            ]}
                            icon={buatIkonOrang(segar)}
                            ref={(el) => {
                                if (el) markerRefs.current[loc.user_id] = el
                            }}
                        >

                            <Popup>
                                <div style={{ minWidth: '180px' }}>

                                    <h3 style={{ margin: 0 }}>
                                        {segar ? '🟢' : '⚪'} {loc.User?.name}
                                    </h3>

                                    <hr />

                                    <p>
                                        <b>Role:</b> {loc.User?.role}
                                    </p>

                                    <p>
                                        <b>Update:</b> {formatUmur(loc.updated_at)}
                                    </p>

                                    {loc.accuracy && (
                                        <p>
                                            <b>Akurasi:</b> ±{Math.round(loc.accuracy)} m
                                        </p>
                                    )}

                                </div>
                            </Popup>

                        </Marker>
                    )

                })}

            </MarkerClusterGroup>

        </MapContainer>
    )
}
