'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'


import {
    Home,
    CalendarDays,
    Users,
    ShoppingCart,
    BarChart3,
    MapPin,
    Navigation,
    Tag,
    Package,
    UserCog,
    Settings,
    LogOut,
    ChevronLeft,
    ChevronRight,
    X
} from 'lucide-react'

export default function Sidebar({

    collapsed,
    onToggleCollapsed,
    mobileOpen,
    onCloseMobile

}: {

    collapsed: boolean
    onToggleCollapsed: () => void
    mobileOpen: boolean
    onCloseMobile: () => void

}) {

    const pathname = usePathname()

    const [role, setRole] = useState('')
    const [name, setName] = useState('')
    const router =
        useRouter()

    // Breakpoint sama dengan Tailwind `md` (768px) -- dipakai supaya
    // label menu tidak ikut hilang gara-gara `collapsed` waktu drawer
    // dibuka di layar kecil. Lebar drawer sendiri sudah dipaksa penuh
    // (w-72) di bawah md lewat className, jadi cuma render label yang
    // perlu tahu ukuran layar.
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {

        const mq = window.matchMedia('(max-width: 767px)')

        const update = () => setIsMobile(mq.matches)

        update()
        mq.addEventListener('change', update)

        return () => mq.removeEventListener('change', update)

    }, [])

    const collapsedVisual = collapsed && !isMobile

    const handleLogout = () => {

        localStorage.clear()

        router.push('/login')

    }

    useEffect(() => {


        setRole(
            localStorage.getItem('role') || ''
        )

        setName(
            localStorage.getItem('name') || ''
        )


        // Sidebar dirender sekali di root layout, jadi tidak pernah
        // remount saat pindah halaman -- logout/login memakai
        // router.push (navigasi client-side), bukan reload penuh.
        // Tanpa `pathname` di dependency, role/name yang dibaca di sini
        // nyangkut dari user sebelumnya sampai tab di-refresh manual.
    }, [pathname])

    const hasAccess = (
        roles: string[]
    ) => roles.includes(role)

    const menuClass = (
        href: string
    ) =>
        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
     ${pathname === href
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-slate-700 hover:bg-slate-800 hover:text-white'
        }`

    return (


        <aside

            className={`
    fixed
    left-0
    top-0
    h-screen
    flex
    flex-col
    bg-slate-950
    border-r
    border-slate-800
    transition-all
    duration-300
    z-50
    w-72
    ${collapsed ? 'md:w-20' : 'md:w-72'}
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
    md:translate-x-0
  `}

        >

            {/* HEADER */}

            <div className="shrink-0 p-5 border-b border-slate-800">

                <div className="flex items-center justify-between">

                    {!collapsedVisual && (

                        <div>

                            <h1 className="text-white font-bold text-xl">
                                SRA PRO
                            </h1>

                            <p className="ext-slate-600 text-xs">
                                Sales Route Automation
                            </p>

                        </div>

                    )}

                    <button

                        onClick={onToggleCollapsed}

                        className="
          hidden
          md:block
          text-slate-700
          hover:text-white
          cursor-pointer
        "

                    >

                        {

                            collapsed

                                ? <ChevronRight size={20} />

                                : <ChevronLeft size={20} />

                        }

                    </button>

                    <button

                        onClick={onCloseMobile}

                        className="
          md:hidden
          text-slate-700
          hover:text-white
          cursor-pointer
        "

                    >

                        <X size={20} />

                    </button>

                </div>

            </div>

            {/* USER */}

            <div className="shrink-0 p-5">

                <div className="flex items-center gap-3">

                    <div

                        className="
          h-12
          w-12
          rounded-full
          bg-blue-600
          flex
          items-center
          justify-center
          text-white
          font-bold
        "

                    >

                        {

                            name

                                ? name.charAt(0)
                                    .toUpperCase()

                                : 'U'

                        }

                    </div>

                    {!collapsedVisual && (

                        <div>

                            <div className="text-white font-medium">

                                {name}

                            </div>

                            <div className="text-xs ext-slate-600">

                                {role}

                            </div>

                        </div>

                    )}

                </div>

            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">

                {/* MAIN */}

                {!collapsedVisual && (
                    <p className="text-xs ext-slate-700 mb-3">
                        MAIN
                    </p>
                )}

                <div className="space-y-2">

                    <Link href="/" className={menuClass('/')} onClick={onCloseMobile}>
                        <Home size={18} />
                        {!collapsedVisual && 'Dashboard'}
                    </Link>

                    <Link
                        href="/visit-plans"
                        className={menuClass('/visit-plans')}
                        onClick={onCloseMobile}
                    >
                        <CalendarDays size={18} />
                        {!collapsedVisual && 'Visit Plan'}
                    </Link>

                    <Link
                        href="/customers"
                        className={menuClass('/customers')}
                        onClick={onCloseMobile}
                    >
                        <Users size={18} />
                        {!collapsedVisual && 'Customer'}
                    </Link>

                </div>

                {/* SALES */}

                {!collapsedVisual && (
                    <p className="text-xs ext-slate-700 mt-8 mb-3">
                        SALES
                    </p>
                )}

                <div className="space-y-2">

                    <Link
                        href="/orders"
                        className={menuClass('/orders')}
                        onClick={onCloseMobile}
                    >
                        <ShoppingCart size={18} />
                        {!collapsedVisual && 'Orders'}
                    </Link>

                    <Link
                        href="/report"
                        className={menuClass('/report')}
                        onClick={onCloseMobile}
                    >
                        <BarChart3 size={18} />
                        {!collapsedVisual && 'Report'}
                    </Link>

                    <Link
                        href="/live-tracking"
                        className={menuClass('/live-tracking')}
                        onClick={onCloseMobile}
                    >
                        <Navigation size={18} />
                        {!collapsedVisual && 'Live Tracking'}
                    </Link>

                </div>

                {/* ADMIN */}

                {

                    role === 'ADMINISTRATOR' &&

                    <>

                        {!collapsedVisual && (
                            <p className="text-xs ext-slate-700 mt-8 mb-3">
                                ADMIN
                            </p>
                        )}

                        <div className="space-y-2">

                            <Link
                                href="/products"
                                className={menuClass('/products')}
                                onClick={onCloseMobile}
                            >
                                <Package size={18} />
                                {!collapsedVisual && 'Products'}
                            </Link>

                            <Link
                                href="/users"
                                className={menuClass('/users')}
                                onClick={onCloseMobile}
                            >
                                <UserCog size={18} />
                                {!collapsedVisual && 'Users'}
                            </Link>

                            <Link
                                href="/activity/create"
                                className={menuClass('/activity/create')}
                                onClick={onCloseMobile}
                            >
                                <Settings size={18} />
                                {!collapsedVisual && 'Activity Master'}
                            </Link>

                            <Link
                                href="/areas"
                                className={menuClass('/areas')}
                                onClick={onCloseMobile}
                            >
                                <MapPin size={18} />
                                {!collapsedVisual && 'Areas'}
                            </Link>

                            <Link
                                href="/classes"
                                className={menuClass('/classes')}
                                onClick={onCloseMobile}
                            >
                                <Tag size={18} />
                                {!collapsedVisual && 'Classes'}
                            </Link>

                        </div>

                    </>

                }

            </div>

            {/* LOGOUT -- child flex biasa (bukan absolute) supaya
                selalu duduk tepat di bawah nav apa adanya, ikut aliran
                flex-col aside; nav di atasnya (flex-1 min-h-0) yang
                otomatis menyusut ngasih sisa ruang ke footer ini,
                jadi tidak pernah saling tumpuk di ukuran/zoom manapun. */}

            <div

                className="
      shrink-0
      p-4
      border-t
      border-slate-800
    "

            >

                <button

                    className="
        w-full
        flex
        items-center
        gap-3
        px-4
        py-3
        rounded-xl
        text-red-400
        hover:bg-red-500/10
      "
                    onClick={handleLogout}
                >


                    <LogOut size={18} />

                    {!collapsedVisual && 'Logout'}

                </button>

            </div>

        </aside>


    )

}











// 'use client'

// import Link from 'next/link'
// import {
//     useEffect,
//     useState
// } from 'react'
// import { usePathname } from 'next/navigation'

// export default function Sidebar() {

//     const [role, setRole] =
//         useState('')

//     useEffect(() => {

//         const userRole =
//             localStorage.getItem(
//                 'role'
//             )

//         if (userRole) {

//             setRole(userRole)

//         }

//     }, [])

//     // CHECK ACCESS
//     const hasAccess = (
//         roles: string[]
//     ) => {

//         return roles.includes(role)

//     }


//     //PATHNAME
//     const pathname =
//         usePathname()

//     const [collapsed,
//         setCollapsed] =
//         useState(false)

//     return (

//         <div

//             style={{

//                 width:

//                     collapsed

//                         ? 80

//                         : 260,

//                 background:
//                     '#111827',

//                 color:
//                     '#fff',

//                 height:
//                     '100vh',

//                 padding: 20,

//                 transition:
//                     'all .3s ease',

//                 position:
//                     'fixed',

//                 left: 0,

//                 top: 0,

//                 overflowY:
//                     'auto',

//                 zIndex: 999

//             }}

//         >

//             <div

//                 style={{

//                     display: 'flex',

//                     justifyContent:

//                         collapsed

//                             ? 'center'

//                             : 'space-between',

//                     alignItems: 'center',

//                     marginBottom: 30

//                 }}

//             >

//                 {

//                     !collapsed &&

//                     <h2>

//                         SALES APPS

//                     </h2>

//                 }

//                 <button

//                     onClick={() =>

//                         setCollapsed(

//                             !collapsed

//                         )

//                     }

//                     style={{

//                         background: 'none',

//                         border: 'none',

//                         color: '#fff',

//                         fontSize: 22,

//                         cursor: 'pointer'

//                     }}

//                 >

//                     ☰

//                 </button>

//             </div>

//             <ul style={{

//                 listStyle: 'none',

//                 padding: 0,

//                 display: 'flex',

//                 flexDirection: 'column',

//                 gap: 10

//             }}>

//                 {/* DASHBOARD */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR',
//                         'SPG'

//                     ])

//                     && (

//                         <li>

//                             <Link

//                                 href="/"

//                                 style={{

//                                     display: 'flex',

//                                     alignItems: 'center',

//                                     gap: 10,

//                                     padding: '10px',

//                                     borderRadius: 10,

//                                     color: '#fff',

//                                     textDecoration: 'none',

//                                     background:

//                                         pathname === '/'

//                                             ? '#dcaa86'

//                                             : 'transparent'

//                                 }}

//                             >

//                                 🏠

//                                 {

//                                     !collapsed &&

//                                     'Dashboard'

//                                 }

//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* VISIT PLANS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'SUPERVISOR',
//                         'SPG'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/visit-plans"

//                                 style={{

//                                     display: 'flex',

//                                     alignItems: 'center',

//                                     gap: 10,

//                                     padding: '10px',

//                                     borderRadius: 10,

//                                     color: '#fff',

//                                     textDecoration: 'none',

//                                     background:

//                                         pathname === '/'

//                                             ? '#dcaa86'

//                                             : 'transparent'

//                                 }}
//                             >
//                                 {

//                                     !collapsed &&

//                                     'Visit Plans'

//                                 }
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* CUSTOMERS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR',
//                         'SPG'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/customers"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Customers
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* PRODUCTS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'SUPERVISOR'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/products"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Products
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* ORDERS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR'

//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/orders"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Orders
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* VISITS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/visits"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Visits
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* VISIT MAP */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/visits/map"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Visits Map
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* ACTIVITY HISTORY */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR',
//                         'SPG'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/visits/activity/list"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Activity History
//                             </Link>

//                         </li>

//                     )

//                 }
//                 {/* Mapping Product*/}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR'


//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/customer-products"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Mapping Product
//                             </Link>

//                         </li>

//                     )

//                 }


//                 {/* USERS */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR'
//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/users"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Users
//                             </Link>

//                         </li>

//                     )

//                 }

//                 {/* Activity Master */}
//                 {

//                     hasAccess([
//                         'ADMINISTRATOR',
//                         'MANAGER',
//                         'SUPERVISOR'

//                     ])

//                     && (

//                         <li>

//                             <Link
//                                 href="/activity/create"
//                                 style={{
//                                     color: '#fff'
//                                 }}
//                             >
//                                 Activity Master
//                             </Link>

//                         </li>

//                     )

//                 }

//             </ul>

//         </div>

//     )

// }