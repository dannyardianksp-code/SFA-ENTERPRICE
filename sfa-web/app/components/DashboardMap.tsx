'use client'

import {

    MapContainer,
    TileLayer,
    Marker,
    Popup

} from 'react-leaflet'

import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

const visitedIcon =
    new L.Icon({

        iconUrl:
            'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',

        shadowUrl:
            'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',

        iconSize: [25, 41],

        iconAnchor: [12, 41]

    })

const pendingIcon =
    new L.Icon({

        iconUrl:
            'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-orange.png',

        shadowUrl:
            'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',

        iconSize: [25, 41],

        iconAnchor: [12, 41]

    })

export default function DashboardMap({

    visitedStores,

    pendingStores

}: any) {

    const center =

        visitedStores.length > 0

            ? [

                Number(

                    visitedStores[0]

                        .Customer.latitude

                ),

                Number(

                    visitedStores[0]

                        .Customer.longitude

                )

            ]

            :

            [-6.2, 106.8]

    return (

        <div

            style={{

                height: 500,

                borderRadius: 20,

                overflow: 'hidden'

            }}

        >

            <MapContainer

                center={center as any}

                zoom={13}

                style={{

                    height: '100%',

                    width: '100%'

                }}

            >

                <TileLayer

                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"

                />

                {

                    visitedStores.map(

                        (store: any) => (

                            <Marker

                                key={

                                    `v-${store.id}`

                                }

                                icon={visitedIcon}

                                position={[

                                    Number(

                                        store.Customer.latitude

                                    ),

                                    Number(

                                        store.Customer.longitude

                                    )

                                ]}

                            >

                                <Popup>

                                    ✅

                                    {' '}

                                    {

                                        store.Customer.name

                                    }

                                </Popup>

                            </Marker>

                        )

                    )

                }

                {

                    pendingStores.map(

                        (store: any) => (

                            <Marker

                                key={

                                    `p-${store.id}`

                                }

                                icon={pendingIcon}

                                position={[

                                    Number(

                                        store.Customer.latitude

                                    ),

                                    Number(

                                        store.Customer.longitude

                                    )

                                ]}

                            >

                                <Popup>

                                    ⏳

                                    {' '}

                                    {

                                        store.Customer.name

                                    }

                                </Popup>

                            </Marker>

                        )

                    )

                }

            </MapContainer>

        </div>

    )

}