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

// 🔥 FIX ICON MARKER
delete (L.Icon.Default.prototype as any)._getIconUrl

L.Icon.Default.mergeOptions({
    iconUrl: require('leaflet/dist/images/marker-icon.png'),
    shadowUrl: require('leaflet/dist/images/marker-shadow.png')
})

// 🔥 FIX BIAR MAP NGGAK PATAH
function FixMap() {
    const map = useMap()

    useEffect(() => {
        setTimeout(() => {
            map.invalidateSize()
        }, 100)
    }, [map])

    return null
}

export default function VisitMap({ visits }: any) {

    // 🔥 AUTO CENTER
    const center =
        visits.length > 0
            ? [
                parseFloat(visits[0].latitude),
                parseFloat(visits[0].longitude)
            ]
            : [-6.3, 106.9]

    return (
        <MapContainer
            center={center as [number, number]}
            zoom={11}
            scrollWheelZoom={true}
            preferCanvas={true}
            maxBounds={[
                [-6.9, 106.3],
                [-5.9, 107.3]
            ]}
            style={{
                height: '600px',
                width: '100%',
                borderRadius: '10px'
            }}
        >

            {/* 🔥 FIX MAP */}
            <FixMap />

            {/* 🔥 TILE */}
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* 🔥 CLUSTER */}
            <MarkerClusterGroup>

                {visits.map((v: any) => (

                    <Marker
                        key={v.id}
                        position={[
                            parseFloat(v.latitude),
                            parseFloat(v.longitude)
                        ]}
                    >

                        <Popup>
                            <div style={{ minWidth: '200px' }}>

                                <h3 style={{ margin: 0 }}>
                                    {v.Customer?.name}
                                </h3>

                                <hr />

                                <p>
                                    <b>MD:</b> {v.User?.name}
                                </p>

                                <p>
                                    <b>Check-in:</b>
                                    <br />
                                    {v.checkin_time}
                                </p>

                                <p>
                                    <b>Lat:</b> {v.latitude}
                                    <br />

                                    <b>Lng:</b> {v.longitude}
                                </p>

                            </div>
                        </Popup>

                    </Marker>

                ))}

            </MarkerClusterGroup>

        </MapContainer>
    )
}