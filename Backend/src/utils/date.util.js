/**
 * Zona waktu bisnis. Semua tanggal "hari ini" dihitung di zona ini —
 * bukan di zona server, dan bukan UTC.
 *
 * Satu-satunya tempat nilai ini ditulis. dashboard.routes.js sebelumnya
 * menuliskannya sendiri sementara visitPlan.controller.js memakai UTC;
 * dua tempat berbeda cara adalah bagaimana bug ini bisa hidup lama.
 */
const BUSINESS_TIMEZONE = 'Asia/Jakarta'


/**
 * Tanggal lokal dalam bentuk YYYY-MM-DD.
 *
 * en-CA dipakai karena locale itu memang memformat tanggal sebagai
 * YYYY-MM-DD — lebih pendek dan lebih sulit disalahtulis daripada
 * menyusun sendiri dari getFullYear/getMonth/getDate.
 *
 * JANGAN ganti dengan toISOString().split('T')[0]. Itu UTC: di WIB
 * (UTC+7) setiap pagi antara 00:00 dan 07:00 hasilnya tanggal kemarin.
 * Lihat tests/unit/date.util.test.js yang menuliskan kedua nilainya
 * berdampingan.
 */
const localDateString = (date = new Date()) =>
    date.toLocaleDateString('en-CA', { timeZone: BUSINESS_TIMEZONE })


/**
 * Tanggal `days` hari setelah `date`, dalam bentuk YYYY-MM-DD lokal.
 *
 * Menyalin Date-nya lebih dulu karena setDate memutasi objek aslinya,
 * dan pemanggil yang mengirim `new Date()` lalu memakainya lagi akan
 * mendapat nilai yang sudah bergeser.
 *
 * Menggeser per hari kalender, bukan menambah 24 jam dalam milidetik:
 * penggeseran hari mempertahankan offset zona waktunya.
 */
const addDaysLocal = (date, days) => {

    const geser = new Date(date.getTime())

    geser.setDate(geser.getDate() + days)

    return localDateString(geser)

}


module.exports = {
    BUSINESS_TIMEZONE,
    localDateString,
    addDaysLocal,
}
