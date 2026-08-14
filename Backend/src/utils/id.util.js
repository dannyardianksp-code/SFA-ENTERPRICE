/**
 * MySQL mengoersi string saat membandingkan dengan kolom angka:
 * `WHERE id = '2abc'` cocok dengan baris id 2. Sementara di JavaScript
 * Number('2abc') adalah NaN, sehingga perbandingannya tidak cocok.
 *
 * Selisih itu membuat penjaga "tidak boleh mengubah akun sendiri" bisa
 * dilewati hanya dengan menambahkan huruf ke URL. Karena itu id
 * dinormalkan sekali di sini, dan nilai hasilnya — bukan
 * req.params.id — yang dipakai baik oleh penjaga maupun oleh klausa
 * where.
 *
 * null = bukan id yang sah.
 */
const parseId = (value) => {

    const angka = Number(value)

    if (!Number.isInteger(angka) || angka < 1) {
        return null
    }

    return angka

}


module.exports = { parseId }
