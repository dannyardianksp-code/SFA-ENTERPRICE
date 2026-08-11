const { resolveAccessibleAreaIds } = require('./area.util')

const { Op } = require('sequelize')

const User = require('../models/user.model')

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


/**
 * Role yang melihat data semua orang, tanpa dibatasi hierarki.
 */
const UNRESTRICTED_ROLES = ['ADMINISTRATOR']


/** Role yang boleh mengubah dan menghapus jadwal kunjungan. */
const PLAN_WRITER_ROLES = ['SUPERVISOR', 'MANAGER', 'ADMINISTRATOR']


/**
 * Pengaman terakhir kalau data supervisor_id sampai melingkar.
 * Penyaring id yang sudah terkumpul sudah menangani lingkaran; batas ini
 * hanya jaring kalau penyaringnya sendiri yang keliru.
 */
const MAX_HIERARCHY_DEPTH = 10


/**
 * Menurunkan rantai atasan-bawahan sampai habis.
 *
 * `fetchChildren` diterima sebagai parameter, bukan dipanggil langsung ke
 * database, supaya dua kasus yang paling perlu diuji — data melingkar dan
 * batas kedalaman — bisa dibuat dengan pengambil palsu. Keduanya tidak
 * mungkin dibuat dari data sungguhan.
 *
 * rootId selalu jadi elemen pertama: dengan begitu kasus SPG tanpa
 * bawahan jatuh dengan sendirinya menjadi [dirinya], tanpa cabang khusus.
 *
 * @param {number} rootId
 * @param {(ids: number[]) => Promise<number[]>} fetchChildren
 * @returns {Promise<number[]>}
 */
const collectSubtreeIds = async (rootId, fetchChildren) => {

    const terkumpul = [rootId]

    let batas = [rootId]

    for (

        let kedalaman = 0;
        kedalaman < MAX_HIERARCHY_DEPTH && batas.length > 0;
        kedalaman++

    ) {

        const anak = await fetchChildren(batas)

        // Menyaring yang sudah terkumpul — INI yang menghentikan data
        // melingkar. Tanpa baris ini, A membawahi B dan B membawahi A
        // akan berputar sampai batas kedalaman setiap kali.
        batas = [...new Set(anak)].filter(
            id => !terkumpul.includes(id)
        )

        terkumpul.push(...batas)

    }

    return terkumpul

}


/**
 * User mana saja yang datanya boleh dilihat oleh `user`.
 *
 * Mengembalikan `null` untuk role tak terbatas — BUKAN array kosong.
 * Array kosong berarti "tidak ada siapa pun", kebalikan dari "semua
 * orang", dan membalik keduanya mengubah administrator dari melihat
 * segalanya menjadi melihat nol tanpa error apa pun.
 *
 * Menjawab "data siapa yang boleh saya lihat". Untuk "di mana saya boleh
 * bertindak", pakai assertAreaChannelAccess di berkas ini — dua
 * pertanyaan berbeda yang tidak boleh dicampur.
 *
 * @param {object} user instance User
 * @returns {Promise<number[]|null>}
 */
const resolveSubordinateUserIds = async (user) => {

    // Gagal tertutup: user kosong melihat nol, bukan segalanya.
    if (!user) {
        return []
    }

    if (UNRESTRICTED_ROLES.includes(user.role)) {
        return null
    }

    return collectSubtreeIds(

        user.id,

        async (ids) => {

            const anak = await User.findAll({

                where: {
                    supervisor_id: { [Op.in]: ids },
                },

                attributes: ['id'],

            })

            return anak.map(u => u.id)

        }

    )

}


module.exports = {
    assertAreaChannelAccess,
    RESTRICTED_ROLES,
    PLAN_WRITER_ROLES,
    MAX_HIERARCHY_DEPTH,
    collectSubtreeIds,
    resolveSubordinateUserIds,
}
