'use client'

import { useEffect, useState } from 'react'

import { usePathname } from 'next/navigation'

import dynamic from 'next/dynamic'

import { getToken } from '../utils/auth'

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

    const pathname = usePathname()

    const [collapsed, setCollapsed] = useState(false)
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {

        // Dicek ulang tiap pindah halaman -- pathname berubah tepat
        // setelah login (ke "/") dan logout (ke "/login"), jadi drawer
        // langsung ikut, sama seperti alasan Sidebar sendiri baca ulang
        // role/name per pathname.
        setLoggedIn(Boolean(getToken()))

    }, [pathname])

    if (!loggedIn) {

        return <>{children}</>

    }

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
