const User = require('../models/user.model')
const Area = require('../models/area.model')

// Sama default dengan Area.timezone di model -- dipakai kalau user
// tidak punya area sama sekali (akun tanpa area_id/AssignedAreas).
const DEFAULT_TIMEZONE = 'Asia/Jakarta'

/**
 * Timezone IANA (WIB/WITA/WIT) area seorang user, buat menghitung
 * "hari ini" versi DIA -- bukan versi kantor pusat. Dipakai di semua
 * tempat yang sebelumnya diam-diam asumsi WIB lewat
 * date.util.js#localDateString (absen, gerbang visit-plan, dashboard
 * SPG).
 *
 * Area PERTAMA yang dipakai kalau user punya lebih dari satu
 * AssignedAreas (jarang beda zona waktu sekaligus dalam satu
 * penugasan) -- sama pola prioritas dengan resolveAccessibleAreaIds:
 * AssignedAreas dulu, br fallback ke area_id legacy.
 *
 * @param {number} userId
 * @returns {Promise<string>} IANA timezone, 'Asia/Jakarta' kalau user
 *   tidak ditemukan atau tidak punya area sama sekali.
 */
const resolveUserTimezone = async (userId) => {

    if (!userId) {
        return DEFAULT_TIMEZONE
    }

    const user = await User.findByPk(userId, {
        include: [
            {
                model: Area,
                as: 'AssignedAreas',
                attributes: ['id', 'timezone'],
                through: { attributes: [] },
            },
            {
                model: Area,
                attributes: ['id', 'timezone'],
            },
        ],
    })

    if (!user) {
        return DEFAULT_TIMEZONE
    }

    const area = user.AssignedAreas?.[0] ?? user.Area

    return area?.timezone || DEFAULT_TIMEZONE

}


/**
 * Menentukan area mana saja yang boleh diakses seorang user.
 *
 * Sumber utamanya multi-area lewat tabel user_areas (relasi
 * AssignedAreas). Kolom lama `user.area_id` dipakai sebagai FALLBACK
 * supaya user yang belum dipindahkan ke user_areas tidak kehilangan
 * akses selama masa transisi.
 *
 * Dipakai bersama oleh getAll dan getNearbyCustomers — jangan
 * duplikasi logikanya, karena dua endpoint yang menghitung hak akses
 * dengan cara berbeda adalah sumber bug yang sulit dilacak.
 *
 * HAPUS fallback-nya setelah semua user selesai di-assign ke
 * user_areas, supaya `area_id` tidak lagi jadi jalur diam-diam.
 *
 * @param {object} user instance User dengan include AssignedAreas
 * @returns {number[]} daftar area id, [] kalau tidak punya akses
 */
const resolveAccessibleAreaIds = (user) => {

    if (!user) {
        return []
    }

    if (user.AssignedAreas?.length > 0) {

        return user.AssignedAreas.map(
            area => area.id
        )

    }

    return user.area_id
        ? [user.area_id]
        : []

}


module.exports = {
    resolveAccessibleAreaIds,
    resolveUserTimezone,
}
