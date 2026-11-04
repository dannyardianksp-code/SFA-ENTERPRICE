const RoleMenuOverride = require('../models/roleMenuOverride.model')

/**
 * Gerbang SERVER generik untuk kapabilitas yang diatur lewat Menu
 * Access (channel_id + platform + role + menu_key).
 *
 * Sidebar/QuickMenu cuma menyembunyikan link/tombol -- tanpa cek ini,
 * siapa pun yang tahu URL API-nya tetap bisa memakai fitur yang
 * menunya/kapabilitasnya disembunyikan. ADMINISTRATOR selalu boleh;
 * role lain ikut override (channel + role user itu), dan kalau belum
 * ada override pakai `defaultVisible`.
 *
 * @param {object} user req.user
 * @param {'WEB'|'MOBILE'} platform
 * @param {string} menuKey key menu/kapabilitas
 * @param {boolean} defaultVisible
 * @returns {Promise<boolean>}
 */
const hasMenuAccess = async (user, platform, menuKey, defaultVisible = false) => {

    if (!user) return false

    if (user.role === 'ADMINISTRATOR') return true

    // User tanpa channel tidak pernah cocok baris override mana pun --
    // sama seperti GET /role-menu-access/mine.
    if (!user.channel_id) return defaultVisible

    const override = await RoleMenuOverride.findOne({
        where: {
            platform,
            channel_id: user.channel_id,
            role: user.role,
            menu_key: menuKey,
        },
    })

    return override ? !!override.visible : defaultVisible

}

/**
 * Menu web -- dipakai Excel Uploader dkk. Aturannya sama persis dengan
 * Sidebar.tsx (grup ADMIN di sidebar-menu.ts default tersembunyi).
 */
const hasWebMenuAccess = (user, menuKey, defaultVisible = false) =>
    hasMenuAccess(user, 'WEB', menuKey, defaultVisible)

/**
 * Kapabilitas mobile -- dipakai Visit Nearby dkk. BEDA dengan menu
 * QuickMenu biasa (yang defaultnya TAMPIL, lihat isMobileMenuVisibleByDefault
 * di sfa-web): kapabilitas seperti ini sengaja dipanggil dengan
 * defaultVisible=false oleh pemanggilnya -- kemampuan baru yang agak
 * sensitif (bisa bikin kunjungan tanpa jadwal) mulai dari tertutup
 * sampai admin eksplisit mengaktifkan per channel+jabatan.
 */
const hasMobileMenuAccess = (user, menuKey, defaultVisible = false) =>
    hasMenuAccess(user, 'MOBILE', menuKey, defaultVisible)

module.exports = { hasMenuAccess, hasWebMenuAccess, hasMobileMenuAccess }
