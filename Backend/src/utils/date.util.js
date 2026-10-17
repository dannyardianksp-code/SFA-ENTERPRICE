/**
 * Zona waktu bisnis DEFAULT -- dipakai kalau pemanggil tidak
 * menyertakan timezone eksplisit. Sejak Area punya kolom timezone
 * sendiri (WIB/WITA/WIT, lihat migration 027), pemanggil yang
 * menghitung "hari ini" MILIK SESEORANG (absen, gerbang visit-plan,
 * dashboard SPG) wajib mengoper timezone area orang itu lewat
 * resolveUserTimezone (area.util.js) -- bukan diam-diam ikut default
 * ini. Default ini cuma jaring pengaman buat pemanggil yang belum
 * sempat dikaitkan ke user tertentu.
 *
 * Satu-satunya tempat nilai ini ditulis. dashboard.routes.js sebelumnya
 * menuliskannya sendiri sementara visitPlan.controller.js memakai UTC;
 * dua tempat berbeda cara adalah bagaimana bug ini bisa hidup lama.
 */
const BUSINESS_TIMEZONE = 'Asia/Jakarta'


/**
 * Tanggal lokal dalam bentuk YYYY-MM-DD, pada `timezone` (default
 * BUSINESS_TIMEZONE/WIB kalau tidak diisi).
 *
 * en-CA dipakai karena locale itu memang memformat tanggal sebagai
 * YYYY-MM-DD — lebih pendek dan lebih sulit disalahtulis daripada
 * menyusun sendiri dari getFullYear/getMonth/getDate.
 *
 * JANGAN ganti dengan toISOString().split('T')[0]. Itu UTC: di WIB
 * (UTC+7) setiap pagi antara 00:00 dan 07:00 hasilnya tanggal kemarin
 * -- beda lagi offsetnya di WITA/WIT. Lihat tests/unit/date.util.test.js
 * yang menuliskan kedua nilainya berdampingan.
 */
const localDateString = (date = new Date(), timezone = BUSINESS_TIMEZONE) =>
    date.toLocaleDateString('en-CA', { timeZone: timezone })


/**
 * Tanggal `days` hari setelah `date`, dalam bentuk YYYY-MM-DD lokal
 * pada `timezone` (default BUSINESS_TIMEZONE/WIB).
 *
 * Menyalin Date-nya lebih dulu karena setDate memutasi objek aslinya,
 * dan pemanggil yang mengirim `new Date()` lalu memakainya lagi akan
 * mendapat nilai yang sudah bergeser.
 *
 * Menggeser per hari kalender, bukan menambah 24 jam dalam milidetik:
 * penggeseran hari mempertahankan offset zona waktunya.
 */
const addDaysLocal = (date, days, timezone = BUSINESS_TIMEZONE) => {

    const geser = new Date(date.getTime())

    geser.setDate(geser.getDate() + days)

    return localDateString(geser, timezone)

}


module.exports = {
    BUSINESS_TIMEZONE,
    localDateString,
    addDaysLocal,
}
