'use client'

import { useEffect, useState } from 'react'

import { usePathname, useRouter } from 'next/navigation'

import dynamic from 'next/dynamic'

import { Menu } from 'lucide-react'

import { getToken } from '../utils/auth'

const Sidebar = dynamic(

    () => import('./Sidebar'),

    {

        ssr: false

    }

)

export default function AppShell({

    children

}: {

    children: React.ReactNode

}) {

    const pathname = usePathname()
    const router = useRouter()

    const [collapsed, setCollapsed] = useState(false)
    const [mobileOpen, setMobileOpen] = useState(false)
    const [loggedIn, setLoggedIn] = useState(false)

    useEffect(() => {

        // Dicek ulang tiap pindah halaman -- pathname berubah tepat
        // setelah login (ke "/") dan logout (ke "/login"), jadi drawer
        // langsung ikut, sama seperti alasan Sidebar sendiri baca ulang
        // role/name per pathname.
        const sudahLogin = Boolean(getToken())

        setLoggedIn(sudahLogin)

        // Drawer mobile ditutup tiap pindah halaman -- jaga-jaga kalau
        // navigasi terjadi bukan lewat klik Link di Sidebar (browser
        // back/forward, dsb).
        setMobileOpen(false)

        // Satu-satunya penjaga route di seluruh app -- tanpa ini, URL
        // halaman mana pun tetap bisa diketik/dibuka langsung setelah
        // logout (atau di tab yang tokennya sudah dihapus), karena
        // sebelumnya di sini cuma menyembunyikan Sidebar tanpa pernah
        // mengarahkan balik ke /login. Beberapa halaman (mis. app/page.tsx)
        // punya pengecekan token sendiri juga -- dibiarkan, jadi lapis
        // kedua yang sekarang redundan tapi tidak berbahaya.
        if (!sudahLogin && pathname !== '/login') {

            router.replace('/login')

        }

    }, [pathname, router])

    if (!loggedIn) {

        // Selagi belum login: halaman /login sendiri tetap dirender
        // apa adanya, tapi halaman lain mana pun dikosongkan (bukan
        // ikut dirender lalu buru-buru dialihkan) supaya kontennya
        // tidak sempat kelihatan sama sekali sebelum redirect di atas
        // selesai.
        return pathname === '/login' ? <>{children}</> : null

    }

    return (

        <div style={{ display: 'flex' }}>

            <Sidebar

                collapsed={collapsed}

                onToggleCollapsed={() => setCollapsed(c => !c)}

                mobileOpen={mobileOpen}

                onCloseMobile={() => setMobileOpen(false)}

            />

            {/* Backdrop drawer mobile -- cuma dirender (dan blokir
                klik ke konten di belakangnya) selagi drawer terbuka di
                layar sempit; md:hidden supaya tidak pernah muncul di
                desktop walau state mobileOpen kebetulan true. */}
            {mobileOpen && (

                <div

                    className="fixed inset-0 bg-black/50 z-40 md:hidden"

                    onClick={() => setMobileOpen(false)}

                />

            )}

            {/* md:ml-[80px]/[288px] harus sama persis dengan w-20/w-72
                Tailwind yang dipakai Sidebar sendiri untuk lebarnya --
                cuma berlaku mulai md karena di bawah itu Sidebar jadi
                drawer overlay (position: fixed, tidak mendorong
                konten), jadi main tidak butuh margin sama sekali. */}
            <main

                className={`
        text-slate-900
        flex-1
        min-h-screen
        transition-all
        duration-300
        ${collapsed ? 'md:ml-[80px]' : 'md:ml-[288px]'}
      `}

            >

                {/* Top bar cuma tampil di bawah breakpoint md -- di
                    situ Sidebar jadi drawer off-canvas (lihat
                    Sidebar.tsx), jadi butuh tombol hamburger untuk
                    membukanya karena tidak ada lagi sidebar yang selalu
                    kelihatan di sisi kiri. */}
                <div

                    className="
          md:hidden
          sticky
          top-0
          z-30
          flex
          items-center
          gap-3
          bg-white
          border-b
          border-slate-200
          p-4
        "

                >

                    <button

                        onClick={() => setMobileOpen(true)}

                        className="text-slate-700 cursor-pointer"

                    >

                        <Menu size={22} />

                    </button>

                    <span className="font-semibold text-slate-800">
                        SRA PRO
                    </span>

                </div>

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
