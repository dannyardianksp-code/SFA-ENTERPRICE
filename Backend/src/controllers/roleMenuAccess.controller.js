const db = require('../config/database')

const { sendError, sendServerError } = require('../utils/response.util')

const {
    USER_MANAGER_ROLES,
    USER_ROLES,
} = require('../utils/access.util')

const RoleMenuOverride = require('../models/roleMenuOverride.model')

// Role yang bisa diatur lewat fitur ini. ADMINISTRATOR SENGAJA tidak
// termasuk -- selalu lihat semua menu tanpa terkecuali, tidak boleh
// dibatasi lewat sini sama sekali.
const CONFIGURABLE_ROLES = USER_ROLES.filter(
    (role) => role !== 'ADMINISTRATOR'
)


// ======================
// GET ALL (admin-only) -- buat halaman Menu Access
// ======================
exports.getAll = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(
                res,
                403,
                'Hanya administrator yang boleh melihat menu access.'
            )
        }

        const rows = await RoleMenuOverride.findAll()

        res.json(rows)

    } catch (err) {

        return sendServerError(res, err, 'GET ROLE MENU ACCESS')

    }

}


// ======================
// GET MINE -- dipakai Sidebar, BUKAN admin-only (semua role login
// perlu tau menu mana yang keliatan buat dirinya sendiri)
// ======================
exports.getMine = async (req, res) => {

    try {

        // ADMINISTRATOR tidak pernah dibatasi -- balas array kosong,
        // Sidebar tidak menyaring apa pun buat role ini.
        if (req.user.role === 'ADMINISTRATOR') {
            return res.json([])
        }

        const rows = await RoleMenuOverride.findAll({
            where: { role: req.user.role },
        })

        res.json(rows)

    } catch (err) {

        return sendServerError(res, err, 'GET MY MENU ACCESS')

    }

}


// ======================
// SAVE FOR ROLE (admin-only) -- ganti SELURUH override milik satu
// role sekaligus (tombol "Simpan" di halaman Menu Access nyimpen
// seluruh checklist role yang lagi dibuka, bukan satu-satu per
// checkbox)
// ======================
exports.saveForRole = async (req, res) => {

    try {

        if (!USER_MANAGER_ROLES.includes(req.user.role)) {
            return sendError(
                res,
                403,
                'Hanya administrator yang boleh mengatur menu access.'
            )
        }

        const { role, items } = req.body

        if (!CONFIGURABLE_ROLES.includes(role)) {
            return sendError(
                res,
                400,
                'Role tidak dikenal atau tidak bisa diatur di sini.'
            )
        }

        if (!Array.isArray(items)) {
            return sendError(
                res,
                400,
                'items wajib berupa array {menu_key, visible}.'
            )
        }

        // Hapus-lalu-tulis-ulang dalam SATU transaksi -- lebih sederhana
        // dan tetap benar dibanding upsert satu-satu, karena payload
        // dari halaman Menu Access SELALU membawa status checklist
        // lengkap saat itu (bukan delta), jadi tidak ada override lama
        // yang harus dipertahankan begitu Simpan ditekan.
        await db.transaction(async (t) => {

            await RoleMenuOverride.destroy({
                where: { role },
                transaction: t,
            })

            if (items.length > 0) {
                await RoleMenuOverride.bulkCreate(
                    items.map((item) => ({
                        role,
                        menu_key: item.menu_key,
                        visible: !!item.visible,
                    })),
                    { transaction: t }
                )
            }

        })

        res.json({ message: 'Menu access berhasil disimpan' })

    } catch (err) {

        return sendServerError(res, err, 'SAVE ROLE MENU ACCESS')

    }

}
