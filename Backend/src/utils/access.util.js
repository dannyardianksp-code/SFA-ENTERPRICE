const { resolveAccessibleAreaIds } = require('./area.util')

/**
 * Role yang aksesnya dibatasi ke area dan channel miliknya sendiri.
 *
 * Nilai ini harus cocok dengan kolom users.role yang sebenarnya —
 * enum('SPG','ADMINISTRATOR','MANAGER','SUPERVISOR'). Model User masih
 * menulis ADMIN/SPV dan itu usang; jangan dijadikan acuan.
 */
const RESTRICTED_ROLES = ['SPG', 'SUPERVISOR']

/**
 * Memeriksa apakah user berhak menyentuh customer di area dan channel
 * tertentu.
 *
 * Dipakai bersama oleh create dan kedua endpoint update. Jangan
 * duplikasi logikanya: dua endpoint yang menghitung hak akses dengan
 * cara berbeda pernah membuat sales melihat kumpulan customer yang
 * tidak sama di dua layar.
 *
 * @param {object} user instance User dengan include AssignedAreas
 * @param {number|string} areaId
 * @param {number|string} channelId
 * @returns {null|{status:number,message:string}} null bila boleh
 */
const assertAreaChannelAccess = (user, areaId, channelId) => {

    // Gagal tertutup. Pemanggil seharusnya sudah mengembalikan 404
    // untuk user yang tidak ditemukan; kalau lolos sampai sini, jangan
    // sampai user kosong diperlakukan sebagai role tak terbatas.
    if (!user) {
        return {
            status: 403,
            message: 'Sesi Anda tidak valid. Silakan login ulang.',
        }
    }

    if (!RESTRICTED_ROLES.includes(user.role)) {
        return null
    }

    // Number(): id bisa datang sebagai string dari JSON, sedangkan
    // resolveAccessibleAreaIds mengembalikan angka dari database.
    if (!resolveAccessibleAreaIds(user).includes(Number(areaId))) {
        return {
            status: 403,
            message: 'Area tersebut di luar wilayah Anda.',
        }
    }

    if (Number(channelId) !== Number(user.channel_id)) {
        return {
            status: 403,
            message: 'Channel tersebut di luar jangkauan Anda.',
        }
    }

    return null

}


module.exports = {
    assertAreaChannelAccess,
    RESTRICTED_ROLES,
}
