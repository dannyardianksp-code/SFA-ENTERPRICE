const RoleMenuOverride = require('../models/roleMenuOverride.model')

/**
 * Gerbang SERVER untuk menu web yang diatur lewat Menu Access.
 *
 * Sidebar cuma menyembunyikan link -- tanpa cek ini, siapa pun yang tahu
 * URL API-nya tetap bisa memakai fitur yang menunya disembunyikan.
 * Aturannya sama persis dengan Sidebar.tsx: ADMINISTRATOR selalu boleh;
 * role lain ikut override (platform WEB + channel + role user itu), dan
 * kalau belum ada override pakai `defaultVisible` (grup ADMIN di
 * sidebar-menu.ts default tersembunyi = false).
 *
 * @param {object} user req.user
 * @param {string} menuKey key menu di sidebar-menu.ts
 * @param {boolean} defaultVisible
 * @returns {Promise<boolean>}
 */
const hasWebMenuAccess = async (user, menuKey, defaultVisible = false) => {

    if (!user) return false

    if (user.role === 'ADMINISTRATOR') return true

    // User tanpa channel tidak pernah cocok baris override mana pun --
    // sama seperti GET /role-menu-access/mine.
    if (!user.channel_id) return defaultVisible

    const override = await RoleMenuOverride.findOne({
        where: {
            platform: 'WEB',
            channel_id: user.channel_id,
            role: user.role,
            menu_key: menuKey,
        },
    })

    return override ? !!override.visible : defaultVisible

}

module.exports = { hasWebMenuAccess }
