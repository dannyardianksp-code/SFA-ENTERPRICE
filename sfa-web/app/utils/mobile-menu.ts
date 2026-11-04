import type { ComponentType } from 'react'

import {
    Clock,
    CalendarDays,
    MapPin,
    Users,
    Package,
    BarChart3,
} from 'lucide-react'

type IconComponent = ComponentType<{ size?: number }>

export interface MobileMenuItem {
    key: string
    label: string
    icon: IconComponent
}

export interface MobileMenuGroup {
    key: 'UTAMA'
    label: string
    items: MobileMenuItem[]
}

/**
 * Satu sumber daftar menu QuickMenu mobile, dipakai halaman Menu Access
 * (/menu-access) buat preview & checklist. TIDAK dipakai mobile app
 * sendiri langsung (repo terpisah) -- key di sini harus SAMA PERSIS
 * dengan MOBILE_MENU_ITEMS di
 * mobile/src/shared/menu/mobile-menu.ts, disinkronkan manual tiap ada
 * perubahan (sama pola dengan CONFIGURABLE_ROLES yang juga ditulis
 * ulang di beberapa tempat karena tidak ada paket bersama antar repo).
 *
 * Cuma SATU grup (beda dengan SIDEBAR_MENU_GROUPS yang 3 grup) --
 * QuickMenu mobile belum punya pengelompokan, semuanya tampil rata di
 * satu grid.
 */
export const MOBILE_MENU_GROUPS: MobileMenuGroup[] = [
    {
        key: 'UTAMA',
        label: 'Menu Mobile',
        items: [
            { key: 'attendance', label: 'Absen', icon: Clock },
            { key: 'visitPlan', label: 'Visit Plan', icon: CalendarDays },
            { key: 'nearby', label: 'Nearby', icon: MapPin },
            { key: 'customer', label: 'Customer', icon: Users },
            { key: 'product', label: 'Product', icon: Package },
            { key: 'report', label: 'Report', icon: BarChart3 },
        ],
    },
]

/**
 * Semua item QuickMenu default TAMPIL -- itu perilaku sekarang (semua
 * user lihat keenamnya), baru berubah kalau admin eksplisit
 * menyembunyikan lewat Menu Access.
 */
export const isMobileMenuVisibleByDefault = () => true

/**
 * Kapabilitas di DALAM satu menu mobile -- bukan menu/layar baru,
 * tidak nambah kotak di grid QuickMenu. Dirender menjorok di bawah
 * menu induknya di halaman Menu Access.
 *
 * - key: menu_key yang disimpan sama persis dengan menu biasa
 *   (role_menu_overrides), cuma dikelompokkan terpisah di UI.
 * - parentKey: menu induk di MOBILE_MENU_GROUPS -- kapabilitas ini
 *   otomatis ikut terkunci kalau menu induknya tidak dicentang.
 * - defaultVisible: BEDA dengan menu biasa (selalu true) -- kapabilitas
 *   di sini mulai dari definisinya sendiri, karena beberapa memang
 *   sengaja mulai TERTUTUP (lihat Visit Nearby).
 */
export interface MobileMenuCapability {
    key: string
    parentKey: string
    label: string
    description: string
    defaultVisible: boolean
}

export const MOBILE_MENU_CAPABILITIES: MobileMenuCapability[] = [
    {
        key: 'nearbyCheckin',
        parentKey: 'nearby',
        label: 'Visit Nearby',
        description: 'Check-in toko langsung dari Nearby, tanpa Visit Plan',
        // Kemampuan baru yang agak sensitif (bisa bikin kunjungan tanpa
        // jadwal) -- mulai tertutup sampai admin aktifkan eksplisit per
        // channel+jabatan. Backend (hasMobileMenuAccess) menegakkan
        // default yang sama, jadi nilai di sini harus SAMA PERSIS.
        defaultVisible: false,
    },
]
