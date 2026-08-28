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
const PLAN_WRITER_ROLES = ['SUPERVISOR', 'MANAGER', 'REGIONAL MANAGER', 'GENERAL MANAGER', 'ADMINISTRATOR']


/** Role yang boleh membuat, mengubah, dan menonaktifkan akun user. */
const USER_MANAGER_ROLES = ['ADMINISTRATOR']


/**
 * Nilai sah kolom users.role — sama persis dengan ENUM di database.
 * Dipakai supaya role yang salah ditolak 400, bukan sampai ke MySQL dan
 * kembali sebagai 500.
 */
const USER_ROLES = [
    'SPG',
    'SUPERVISOR',
    'MANAGER',
    'REGIONAL MANAGER',
    'GENERAL MANAGER',
    'ADMINISTRATOR',
]


/**
 * Gerbang untuk route yang menulis akun user.
 *
 * Ditulis sebagai allowlist, bukan blacklist: user kosong, role NULL,
 * nilai warisan seperti 'ADMIN', dan role baru apa pun ditolak secara
 * bawaan. Blacklist akan meloloskan semuanya.
 *
 * null = boleh. { status, message } = tolak.
 */
const assertUserManagement = (user) => {

    if (!user || !USER_MANAGER_ROLES.includes(user.role)) {

        return {
            status: 403,
            message:
                'Hanya administrator yang boleh mengelola akun user.',
        }

    }

    return null

}


/**
 * Apakah satu perubahan akan menghabiskan administrator aktif terakhir?
 *
 * Dipisah menjadi fungsi murni karena cabang penolakannya tidak bisa
 * dicapai lewat e2e: mencapainya butuh database yang hanya punya SATU
 * administrator aktif, sedangkan database dev punya dua akun
 * administrator sungguhan yang tidak boleh diubah oleh tes mana pun.
 * Jadi keputusannya diuji di unit test, dan yang diuji e2e adalah
 * transaksi serta locking read yang memasok `jumlahAdminAktif`.
 *
 * Nol administrator aktif tidak punya jalur pemulihan: reset password
 * pun ADMINISTRATOR-saja, sehingga satu-satunya jalan kembali adalah
 * akses langsung ke database.
 *
 * @param {object|null} target baris user yang akan diubah
 * @param {{role?: string, status?: string}} perubahan nilai BARU saja
 * @param {number} jumlahAdminAktif hasil locking read, bukan cache
 * @returns {boolean} true bila perubahannya harus ditolak
 */
const wouldRemoveLastActiveAdministrator = (
    target,
    perubahan,
    jumlahAdminAktif
) => {

    // Target yang tidak ada, atau yang bukan administrator aktif, tidak
    // mengurangi jumlah administrator aktif apa pun yang terjadi padanya.
    if (!target) {
        return false
    }

    if (
        target.role !== 'ADMINISTRATOR' ||
        target.status !== 'ACTIVE'
    ) {
        return false
    }

    // `!== undefined` dan bukan truthy: field yang tidak dikirim tidak
    // ditulis Sequelize, jadi ia bukan perubahan. Membandingkan NILAI
    // BARU dengan 'ADMINISTRATOR'/'ACTIVE' membuat administrator yang
    // mengirim balik role dan status yang sama — yang dilakukan form
    // user di web setiap kali menyimpan — tidak ikut tertolak.
    const kehilanganRole =
        perubahan.role !== undefined &&
        perubahan.role !== 'ADMINISTRATOR'

    const kehilanganStatus =
        perubahan.status !== undefined &&
        perubahan.status !== 'ACTIVE'

    if (!kehilanganRole && !kehilanganStatus) {
        return false
    }

    // <= 1, bukan === 1: jumlah nol berarti invariannya sudah rusak
    // sebelum request ini, dan menolak tetap lebih benar daripada
    // meloloskan.
    return jumlahAdminAktif <= 1

}


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


/**
 * Klausa where untuk kolom pemilik, dari hasil
 * resolveSubordinateUserIds.
 *
 * null berarti "tidak dibatasi", sehingga TIDAK BOLEH menjadi
 * { [Op.in]: null } — itu SQL yang tidak sah. Array kosong berarti
 * "tidak ada siapa pun", dan { [Op.in]: [] } benar untuk itu.
 *
 * Membalik kedua arti mengubah administrator dari melihat segalanya
 * menjadi melihat nol, tanpa error dan tanpa jejak.
 *
 * Kolomnya bisa diganti karena GET /api/users memfilter `id`, bukan
 * `user_id`.
 */
const ownerWhere = (subordinateIds, column = 'user_id') => {

    if (subordinateIds === null) {
        return {}
    }

    return {
        [column]: {
            [Op.in]: subordinateIds
        }
    }

}


/**
 * Gerbang untuk bacaan sumber-tunggal: bolehkah pemanggil melihat baris
 * milik ownerId.
 *
 * Mengembalikan 403, bukan 404, dan itu disengaja — pemanggil yang tidak
 * berhak tidak perlu diberi tahu apakah id targetnya ada. Sama dengan
 * GET /api/visits/:id dari sub-proyek hierarki.
 *
 * Perbandingannya mengoersi tipe: id dari parameter URL selalu string,
 * sedangkan daftar subtree berisi angka dari database. Tanpa koersi,
 * '37' !== 37 dan supervisor ditolak atas datanya sendiri.
 *
 * null = boleh. { status, message } = tolak.
 */
const assertWithinSubtree = (subordinateIds, ownerId) => {

    if (subordinateIds === null) {
        return null
    }

    const pemilik = Number(ownerId)

    const boleh =
        Number.isInteger(pemilik) &&
        subordinateIds.some(id => Number(id) === pemilik)

    if (!boleh) {
        return {
            status: 403,
            message: 'Data ini di luar jangkauan Anda.',
        }
    }

    return null

}


module.exports = {
    assertAreaChannelAccess,
    RESTRICTED_ROLES,
    PLAN_WRITER_ROLES,
    USER_MANAGER_ROLES,
    USER_ROLES,
    assertUserManagement,
    wouldRemoveLastActiveAdministrator,
    MAX_HIERARCHY_DEPTH,
    collectSubtreeIds,
    resolveSubordinateUserIds,
    ownerWhere,
    assertWithinSubtree,
}
