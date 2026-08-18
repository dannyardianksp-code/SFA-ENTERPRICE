/**
 * Penanganan kontensi lock InnoDB untuk transaksi yang menjaga lantai
 * administrator aktif.
 *
 * Dipisah ke berkas sendiri, bukan disalin ke dua handler: PUT /:id dan
 * PUT /:id/status keduanya butuh perlakuan yang sama, dan review branch
 * ini sudah pernah menemukan logika otorisasi yang bercabang karena
 * disalin. Kondisi yang ditulis dua kali akan berbeda pada perubahan
 * berikutnya.
 */


/**
 * Kode error MariaDB/MySQL untuk kalah balapan lock.
 *
 * 1205 ER_LOCK_WAIT_TIMEOUT — menunggu lebih lama dari
 *      innodb_lock_wait_timeout, lalu menyerah.
 * 1213 ER_LOCK_DEADLOCK — InnoDB mendeteksi siklus tunggu dan memilih
 *      transaksi ini sebagai korban.
 *
 * Keduanya diperiksa dalam bentuk teks MAUPUN angka: mysql2 mengisi
 * `code` dengan teks dan `errno` dengan angka, tapi jalur error lain
 * (koneksi yang dibungkus ulang, atau versi driver yang berbeda) tidak
 * selalu mengisi keduanya.
 */
const KODE_KONFLIK_LOCK = [
    'ER_LOCK_WAIT_TIMEOUT',
    'ER_LOCK_DEADLOCK',
]

const ERRNO_KONFLIK_LOCK = [
    1205,
    1213,
]


/**
 * Batas tunggu lock, dalam detik, untuk transaksi lantai administrator.
 *
 * Global server ada di 50 detik. Nilai itu berbahaya di sini bukan
 * karena lambat, tapi karena transaksi yang MENUNGGU tetap memegang
 * koneksi pool-nya: dengan pool Sequelize max = 5, lima administrator
 * yang menyimpan bersamaan bisa menghabiskan seluruh pool hampir satu
 * menit, dan request lain yang tidak berkaitan — termasuk login mobile —
 * gagal dengan ConnectionAcquireTimeoutError.
 *
 * 5 detik: cukup panjang untuk melewati transaksi lawan yang normal
 * (keduanya hanya membaca beberapa baris lalu menulis satu), cukup
 * pendek supaya yang kalah melepas koneksinya jauh sebelum pool kering.
 */
const BATAS_TUNGGU_LOCK_DETIK = 5


/**
 * Apakah error ini kontensi lock, bukan bug?
 *
 * GAGAL TERTUTUP ke arah `false`: error yang tidak dikenali TIDAK boleh
 * dianggap konflik lock. Salah melaporkan bug sungguhan sebagai "silakan
 * coba lagi" akan menyembunyikannya — pemanggil mengulang, gagal lagi
 * dengan pesan yang sama, dan tidak ada yang pernah melihat 500-nya.
 *
 * Diperiksa lewat KODE, bukan potongan pesan. Sequelize membungkus error
 * driver menjadi SequelizeDatabaseError yang `message`-nya bisa berubah
 * antar versi server, sementara `err.code` dan `err.errno` di level ATAS
 * bahkan tidak ada — nilainya hanya hidup di `err.parent` / `err.original`
 * (keduanya menunjuk objek yang sama). Diverifikasi langsung pada
 * Sequelize 6.37.8 + mysql2 3.22.3: 1205 dan 1213 sama-sama jatuh ke
 * cabang `default` formatError sehingga tidak punya kelas error khusus
 * yang bisa dipakai `instanceof`.
 *
 * Error mysql2 yang belum dibungkus ikut dikenali karena `err` sendiri
 * juga diperiksa, sehingga helper ini tetap benar kalau suatu saat query
 * dijalankan lewat mysql2 langsung.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
const isLockConflictError = (err) => {

    const cocok = (nilai) =>
        KODE_KONFLIK_LOCK.includes(nilai) ||
        ERRNO_KONFLIK_LOCK.includes(nilai)

    // Objek pembungkus dan yang dibungkus, bukan hanya salah satu.
    // `null` dan primitif ikut lewat sini tanpa melempar.
    const kandidat = [
        err,
        err && err.parent,
        err && err.original,
    ]

    return kandidat.some(
        (e) =>
            !!e &&
            typeof e === 'object' &&
            (cocok(e.code) || cocok(e.errno))
    )

}


/**
 * Memasang batas tunggu lock yang pendek pada koneksi milik transaksi.
 *
 * `{ transaction: t }` bukan sekadar penanda: Sequelize memilih koneksi
 * dengan `options.transaction ? options.transaction.connection : pool`
 * (sequelize.js), jadi statement ini dijamin mengenai koneksi transaksi
 * INI dan bukan koneksi lain dari pool. Diverifikasi juga secara empiris —
 * di dalam transaksi, @@SESSION bernilai 5 sementara @@GLOBAL tetap 50,
 * dan lock yang kalah menyerah pada ~5,0 detik, bukan 50.
 *
 * SET SESSION dipakai, bukan SET GLOBAL: setelan server tidak boleh
 * berubah gara-gara satu request, dan perubahan global akan mengenai
 * setiap koneksi aplikasi lain.
 *
 * @param {object} t transaksi Sequelize
 * @param {number} detik
 */
const applyLockWaitTimeout = async (
    t,
    detik = BATAS_TUNGGU_LOCK_DETIK
) => {

    const angka = Number(detik)

    // Nilai ini masuk ke SQL lewat interpolasi karena SET SESSION tidak
    // menerima bind parameter untuk nilai variabelnya. Dipaksa jadi
    // bilangan bulat lebih dulu supaya tidak ada jalan untuk menyisipkan
    // teks apa pun ke dalam statement.
    if (!Number.isInteger(angka) || angka < 1) {
        throw new TypeError(
            'batas tunggu lock harus bilangan bulat positif'
        )
    }

    await t.sequelize.query(
        `SET SESSION innodb_lock_wait_timeout = ${angka}`,
        { transaction: t }
    )

}


/**
 * Mengembalikan batas tunggu lock ke nilai global.
 *
 * Wajib ada karena koneksinya DIKEMBALIKAN ke pool setelah transaksi
 * selesai, dengan setelan sesi yang masih menempel. Tanpa pemulihan ini,
 * koneksi pool satu per satu akan hanyut ke 5 detik dan route lain —
 * yang tidak memetakan 1205 menjadi jawaban yang bisa diulang — mulai
 * menjawab 500 pada kontensi yang sebelumnya cukup ditunggu.
 *
 * `= DEFAULT` dipakai supaya nilai globalnya tidak perlu dibaca dan
 * tidak perlu ditulis ulang sebagai angka tetap di sini; kalau operator
 * mengubah global, pemulihannya ikut benar.
 *
 * TIDAK PERNAH MELEMPAR. Fungsi ini dipanggil dari `finally`, jadi error
 * apa pun dari sini akan menimpa error asli yang sedang naik — justru
 * error lock yang sedang kita coba laporkan. Dua hal yang diabaikan:
 * transaksi yang sudah ditutup (Sequelize me-rollback sendiri saat 1213
 * lalu menolak query berikutnya), dan koneksi yang sudah hilang.
 *
 * @param {object} t transaksi Sequelize
 */
const restoreLockWaitTimeout = async (t) => {

    try {

        // Transaksi yang sudah commit/rollback tidak bisa dipakai lagi;
        // menanyakannya lebih dulu lebih murah daripada menangkap error.
        if (!t || t.finished) {
            return
        }

        await t.sequelize.query(
            'SET SESSION innodb_lock_wait_timeout = DEFAULT',
            { transaction: t }
        )

    } catch (_) {

        // Sengaja dibiarkan. Lihat penjelasan di atas.

    }

}


/**
 * Membungkus callback db.transaction supaya batas tunggu lock dipasang
 * sebelum isinya jalan dan dipulihkan setelahnya.
 *
 * Ditulis sebagai DEKORATOR — menerima callback dan mengembalikan
 * callback — bukan sebagai `withShortLockWait(t, kerja)`. Alasannya
 * bentuk pemakaiannya:
 *
 *     db.transaction(withShortLockWait(async (t) => {
 *         ...
 *     }))
 *
 * Kurung pembukanya tetap di baris yang sama dengan db.transaction,
 * sehingga isi transaksi yang sudah ada tidak perlu digeser satu tingkat
 * indentasi. Bentuk `(t, kerja)` memaksa seluruh badan handler bergeser,
 * dan diff yang isinya perubahan spasi menyembunyikan perubahan yang
 * sebenarnya dari review.
 *
 * Satu implementasi untuk kedua handler: tidak ada handler yang bisa
 * lupa memulihkan setelan sesinya.
 *
 * `finally` aman di sini justru karena restoreLockWaitTimeout tidak
 * pernah melempar — error dari `kerja`, termasuk error lock yang ingin
 * kita laporkan, naik utuh ke pemanggil.
 *
 * @param {(t: object) => Promise<any>} kerja isi transaksi
 * @returns {(t: object) => Promise<any>}
 */
const withShortLockWait = (kerja) => async (t) => {

    await applyLockWaitTimeout(t)

    try {

        return await kerja(t)

    } finally {

        await restoreLockWaitTimeout(t)

    }

}


module.exports = {
    KODE_KONFLIK_LOCK,
    ERRNO_KONFLIK_LOCK,
    BATAS_TUNGGU_LOCK_DETIK,
    isLockConflictError,
    applyLockWaitTimeout,
    restoreLockWaitTimeout,
    withShortLockWait,
}
