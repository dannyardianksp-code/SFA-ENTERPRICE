'use client'

import {
    MapContainer,
    TileLayer,
    Marker,
    Popup,
    useMap
} from 'react-leaflet'

import MarkerClusterGroup from 'react-leaflet-cluster'

import { useEffect } from 'react'

import L from 'leaflet'

import 'leaflet/dist/leaflet.css'
import 'leaflet/dist/images/marker-icon.png'
import 'leaflet/dist/images/marker-shadow.png'

// Sama fix icon dengan VisitMap.tsx -- kalau salah satu berubah, ubah
// keduanya.
delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png')
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

export default function LiveTrackingMap({ locations }: any) {

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
