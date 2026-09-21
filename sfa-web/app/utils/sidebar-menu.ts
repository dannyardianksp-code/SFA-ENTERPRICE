import type { ComponentType } from 'react'

import {
    Home,
    CalendarDays,
    Users,
    ShoppingCart,
    BarChart3,
    Navigation,
    Tag,
    Layers,
    Package,
    UserCog,
    Settings,
    MapPin,
    Lock,
} from 'lucide-react'

// Dipisah dari LucideIcon (tidak konsisten diekspor tiap versi paket) --
// yang benar-benar dipakai Sidebar.tsx cuma `size`, jadi cukup itu yang
// dijanjikan di sini.
type IconComponent = ComponentType<{ size?: number }>

export interface SidebarMenuItem {
    key: string
    href: string
    label: string
    icon: IconComponent
}

export interface SidebarMenuGroup {
    key: 'MAIN' | 'SALES' | 'ADMIN'
    label: string
    items: SidebarMenuItem[]
}

/**
 * Satu sumber daftar menu sidebar. Sidebar.tsx (tampilan) dan halaman
 * Menu Access (/menu-access, siapa boleh lihat apa) sama-sama baca
 * dari sini -- nambah/ubah/hapus menu cukup di satu tempat, tidak ada
 * risiko dua daftar terpisah jadi beda-beda (drift).
 *
 * Urutan array = urutan tampil di sidebar. Visibility SEBENARNYA per
 * role ada di role_menu_overrides (backend) -- lihat
 * isMenuVisibleByDefault di bawah buat aturan defaultnya kalau belum
 * ada override eksplisit.
 */
export const SIDEBAR_MENU_GROUPS: SidebarMenuGroup[] = [
    {
        key: 'MAIN',
        label: 'MAIN',
        items: [
            { key: 'dashboard', href: '/', label: 'Dashboard', icon: Home },
            { key: 'visitPlan', href: '/visit-plans', label: 'Visit Plan', icon: CalendarDays },
            { key: 'customer', href: '/customers', label: 'Customer', icon: Users },
        ],
    },
    {
        key: 'SALES',
        label: 'SALES',
        items: [
            { key: 'orders', href: '/orders', label: 'Orders', icon: ShoppingCart },
            { key: 'report', href: '/report', label: 'Report', icon: BarChart3 },
            { key: 'liveTracking', href: '/live-tracking', label: 'Live Tracking', icon: Navigation },
        ],
    },
    {
        key: 'ADMIN',
        label: 'ADMIN',
        items: [
            { key: 'products', href: '/products', label: 'Products', icon: Package },
            { key: 'users', href: '/users', label: 'Users', icon: UserCog },
            { key: 'activityMaster', href: '/activity/create', label: 'Activity Master', icon: Settings },
            { key: 'areas', href: '/areas', label: 'Areas', icon: MapPin },
            { key: 'classes', href: '/classes', label: 'Classes', icon: Tag },
            { key: 'customerGroups', href: '/customer-groups', label: 'Customer Groups', icon: Layers },
            { key: 'menuAccess', href: '/menu-access', label: 'Menu Access', icon: Lock },
        ],
    },
]

/**
 * Default kalau belum ada override eksplisit di role_menu_overrides --
 * MAIN/SALES keliatan semua role (perilaku sekarang), ADMIN
 * disembunyikan sampai admin buka manual per role. ADMINISTRATOR TIDAK
 * lewat fungsi ini sama sekali -- selalu lihat semua menu tanpa
 * terkecuali (lihat Sidebar.tsx).
 */
export const isMenuVisibleByDefault = (
    groupKey: SidebarMenuGroup['key']
) => groupKey !== 'ADMIN'
