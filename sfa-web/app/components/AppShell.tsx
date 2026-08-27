'use client'

import { useState } from 'react'

import dynamic from 'next/dynamic'

const Sidebar = dynamic(

    () => import('./Sidebar'),

    {

        ssr: false

    }

)

// Sama persis dengan lebar Tailwind w-72 (288px) dan w-20 (80px) yang
// dipakai Sidebar sendiri -- marginLeft main HARUS mengikuti angka yang
// sama, kalau tidak (dulu hardcode 260 dan tidak ikut collapsed sama
// sekali) tampilan jadi tidak simetris saat lebar penuh dan ada area
// kosong lebar saat drawer di-collapse.
const LEBAR_TERBUKA = 288
const LEBAR_COLLAPSED = 80

export default function AppShell({

    children

}: {

    children: React.ReactNode

}) {

    const [collapsed, setCollapsed] = useState(false)

    return (

        <div style={{ display: 'flex' }}>

            <Sidebar

                collapsed={collapsed}

                onToggleCollapsed={() => setCollapsed(c => !c)}

            />

            <main

                className="text-slate-900"

                style={{

                    flex: 1,

                    marginLeft: collapsed ? LEBAR_COLLAPSED : LEBAR_TERBUKA,

                    minHeight: '100vh',

                    transition: 'all .3s ease'

                }}

            >

                <div

                    style={{

                        padding: 24

                    }}

                >

                    {children}

                </div>

            </main>

        </div>

    )

}
