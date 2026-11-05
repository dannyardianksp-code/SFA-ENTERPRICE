/**
 * Nama user DIPAKSA huruf besar semua -- biar rata di seluruh daftar,
 * tidak campur "Budi Santoso" dengan "BUDI SANTOSO" tergantung siapa
 * yang mengetik. Dipakai di create, update, dan upload Excel -- tiga
 * jalur yang sama-sama bisa menulis users.name.
 *
 * Nilai bukan string (termasuk undefined -- field tidak dikirim)
 * dikembalikan apa adanya, supaya tidak mengubah semantik "tidak
 * dikirim = jangan disentuh" pada PUT /:id.
 *
 * @param {unknown} nama
 * @returns {unknown}
 */
const paksaHurufBesar = (nama) =>
    typeof nama === 'string' ? nama.trim().toUpperCase() : nama

module.exports = { paksaHurufBesar }
