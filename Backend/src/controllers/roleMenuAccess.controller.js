const db = require('../config/database')

const { sendError, sendServerError } = require('../utils/response.util')

const {
    USER_MANAGER_ROLES,
    USER_ROLES,
} = require('../utils/access.util')

const RoleMenuOverride = require('../models/roleMenuOverride.model')
const Channel = require('../models/channel.model')

const PLATFORM_VALUES = ['WEB', 'MOBILE']

// Role yang bisa diatur lewat fitur ini -- BEDA per platform, karena
// siapa yang benar-benar memakai tiap platform beda:
// - ADMINISTRATOR tidak pernah termasuk di platform MANA PUN -- selalu
//   lihat semua menu tanpa terkecuali (sidebar penuh di web, menu
//   "Setting" tersendiri di mobile), tidak boleh dibatasi lewat sini.
// - Web: MD/SPG/SALES dikecualikan juga -- ketiga role ini defaultnya
//   TIDAK PUNYA akses web sama sekali (can_access_web default false,
//   cuma dibuka manual per-user lewat form Edit User). Mengatur Menu
//   Access buat role yang pada dasarnya tidak login ke web cuma bikin
//   bingung.
// - Mobile: SEMUA role (termasuk SUPERVISOR ke atas) bisa login dan
//   dikasih menu mobile sendiri -- tidak ada role lapangan vs kantoran
//   di sini, cuma ADMINISTRATOR yang dikecualikan.
const CONFIGURABLE_ROLES_BY_PLATFORM = {
    WEB: USER_ROLES.filter(
        (role) => !['ADMINISTRATOR', 'MD', 'SPG', 'SALES'].includes(role)
    ),
    MOBILE: USER_ROLES.filter(
        (role) => role !== 'ADMINISTRATOR'
    ),
}


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
// GET MINE -- dipakai Sidebar (web) dan QuickMenu (mobile), BUKAN
// admin-only (semua role login perlu tau menu mana yang keliatan buat
// dirinya sendiri). Disaring per channel user ITU SENDIRI -- user
// tanpa channel (channel_id NULL) tidak akan cocok baris mana pun,
// otomatis jatuh ke default per grup di client, sama seperti role yang
// belum pernah di-override.
//
// ?platform=web|mobile -- default 'WEB' kalau tidak dikirim sama
// sekali, supaya pemanggil lama (Sidebar sebelum fitur platform ada)
// tetap jalan tanpa perubahan.
// ======================
exports.getMine = async (req, res) => {

    try {

        // ADMINISTRATOR tidak pernah dibatasi di platform mana pun --
        // balas array kosong, client tidak menyaring apa pun buat
        // role ini (dan di mobile, role ini sama sekali tidak
        // memakai QuickMenu -- lihat menu "Setting" tersendiri).
        if (req.user.role === 'ADMINISTRATOR') {
            return res.json([])
        }

        const platform =
            String(req.query.platform || 'WEB').toUpperCase()

        if (!PLATFORM_VALUES.includes(platform)) {
            return sendError(
                res,
                400,
                `platform wajib salah satu dari ${PLATFORM_VALUES.join(', ')}.`
            )
        }

        const rows = await RoleMenuOverride.findAll({
            where: {
                platform,
                role: req.user.role,
                channel_id: req.user.channel_id,
            },
        })

        res.json(rows)

    } catch (err) {

        return sendServerError(res, err, 'GET MY MENU ACCESS')

    }

}


// ======================
// SAVE FOR PLATFORM + CHANNEL + ROLE (admin-only) -- ganti SELURUH
// override milik satu kombinasi platform+channel+role sekaligus
// (tombol "Simpan" di halaman Menu Access nyimpen seluruh checklist
// yang lagi dibuka, bukan satu-satu per checkbox)
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

        const { channel_id, role, items } = req.body

        const platform =
            String(req.body.platform || 'WEB').toUpperCase()

        if (!PLATFORM_VALUES.includes(platform)) {
            return sendError(
                res,
                400,
                `platform wajib salah satu dari ${PLATFORM_VALUES.join(', ')}.`
            )
        }

        if (!CONFIGURABLE_ROLES_BY_PLATFORM[platform].includes(role)) {
            return sendError(
                res,
                400,
                'Role tidak dikenal atau tidak bisa diatur di platform ini.'
            )
        }

        const channel = channel_id
            ? await Channel.findByPk(channel_id)
            : null

        if (!channel) {
            return sendError(
                res,
                400,
                'Channel wajib dipilih dan harus valid.'
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
                where: { platform, channel_id, role },
                transaction: t,
            })

            if (items.length > 0) {
                await RoleMenuOverride.bulkCreate(
                    items.map((item) => ({
                        platform,
                        channel_id,
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
