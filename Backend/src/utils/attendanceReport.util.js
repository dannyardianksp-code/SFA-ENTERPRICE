// Logika "matang"-nya laporan Attendance -- dipisah dari controller
// supaya bisa diuji tanpa database (sama pola dengan date.util.js,
// excelUpload.util.js, dst).
//
// Endpoint baru BERDIRI SENDIRI (GET /attendances/report) -- sengaja
// TIDAK dipakai ulang oleh checkIn/checkOut/getToday/getAll yang sudah
// ada, dan TIDAK mengubah satu pun logika/format yang sudah dipakai
// web atau mobile sekarang. Murni tambahan baru.

const DEFAULT_TIMEZONE = 'Asia/Jakarta'

const TIMEZONE_LABEL = {
    'Asia/Jakarta': 'WIB',
    'Asia/Makassar': 'WITA',
    'Asia/Jayapura': 'WIT',
}

/**
 * Timezone IANA dari satu baris User yang SUDAH di-include AssignedAreas
 * (through user_areas) dan Area (belongsTo langsung, area_id legacy).
 *
 * Versi SINKRON dari resolveUserTimezone (area.util.js) -- itu
 * melakukan satu query per user (cocok dipanggil sekali per request,
 * mis. saat check-in). Laporan ini menampilkan banyak user sekaligus,
 * jadi usernya di-bulk-fetch SATU query oleh controller, lalu fungsi
 * ini tinggal membaca include yang sudah ada di memori -- supaya tidak
 * N+1 query ke database untuk tiap baris absen.
 *
 * Prioritas SAMA PERSIS dengan resolveUserTimezone: AssignedAreas[0]
 * dulu, baru fallback ke Area (area_id legacy), baru default.
 *
 * @param {object|null} user instance User dengan include AssignedAreas + Area
 * @returns {string} IANA timezone
 */
const resolveTimezoneFromUser = (user) => {

    if (!user) return DEFAULT_TIMEZONE

    const area = user.AssignedAreas?.[0] ?? user.Area

    return area?.timezone || DEFAULT_TIMEZONE

}

/** Label pendek (WIB/WITA/WIT) dari timezone IANA -- timezone itu
 * sendiri dibalas kalau bukan salah satu dari 3 ini (seharusnya tidak
 * pernah terjadi, area.routes.js membatasi pilihannya). */
const timezoneLabel = (timezone) =>
    TIMEZONE_LABEL[timezone] || timezone


/**
 * "16 Nov 2026" dari tanggal DATEONLY ("YYYY-MM-DD") atau timestamp
 * ISO, di timezone yang diberikan. Aman dipakai utk DATEONLY: ketiga
 * timezone Indonesia (WIB/WITA/WIT) semuanya DI DEPAN UTC, jadi
 * "YYYY-MM-DD" yang di-parse sebagai tengah malam UTC tidak pernah
 * mundur satu hari saat diformat ulang ke salah satu dari ketiganya.
 *
 * @param {string|null} nilai
 * @param {string} timezone
 * @returns {string|null}
 */
const formatTanggalLokal = (nilai, timezone) => {

    if (!nilai) return null

    const tanggal = new Date(nilai)

    if (Number.isNaN(tanggal.getTime())) return null

    return new Intl.DateTimeFormat('id-ID', {
        timeZone: timezone,
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(tanggal)

}


/** "08:14" dari timestamp ISO di timezone yang diberikan, null kalau
 * nilainya kosong (belum check-in/out). */
const formatJamLokal = (nilai, timezone) => {

    if (!nilai) return null

    const tanggal = new Date(nilai)

    if (Number.isNaN(tanggal.getTime())) return null

    // Locale 'en-GB', BUKAN 'id-ID' -- id-ID memisah jam:menit pakai
    // titik ("08.14"), bukan titik dua ("08:14"), di ICU Node. en-GB
    // dengan hour12:false memberi format 24 jam titik-dua yang sama
    // persis dipakai di mockup/tampilan lain.
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(tanggal)

}


/**
 * Satu baris Attendance mentah (+ User & timezone-nya yang sudah
 * di-resolve) -> baris laporan yang sudah "matang": tanggal/jam sudah
 * diformat di zona waktu pegawai itu sendiri, status sudah dihitung,
 * label zona waktu sudah ada -- pemanggil tinggal render apa adanya.
 *
 * @param {object} baris instance Attendance (JSON biasa, bukan model)
 * @param {{ name: string, area_name: string|null }} userInfo
 * @param {string} timezone
 */
const buildReportRow = (baris, userInfo, timezone) => ({

    id: baris.id,
    user_id: baris.user_id,
    user_name: userInfo?.name ?? null,
    area_name: userInfo?.area_name ?? null,

    timezone,
    timezone_label: timezoneLabel(timezone),

    tanggal: baris.tanggal,
    tanggal_display: formatTanggalLokal(baris.tanggal, timezone),

    clock_in_time: baris.clock_in_time,
    clock_in_display: formatJamLokal(baris.clock_in_time, timezone),
    clock_in_latitude: baris.clock_in_latitude,
    clock_in_longitude: baris.clock_in_longitude,
    clock_in_photo_url: baris.clock_in_photo_url,

    clock_out_time: baris.clock_out_time,
    clock_out_display: formatJamLokal(baris.clock_out_time, timezone),
    clock_out_latitude: baris.clock_out_latitude,
    clock_out_longitude: baris.clock_out_longitude,
    clock_out_photo_url: baris.clock_out_photo_url,

    // LENGKAP = sudah checkout. BELUM_PULANG = masih terbuka --
    // termasuk kasus yang menumpu dari hari sebelumnya (checkOut
    // sendiri sudah menutup yang TERLAMA duluan, baris ini cuma
    // melaporkan apa adanya, tidak menilai itu wajar atau tidak).
    status: baris.clock_out_time ? 'LENGKAP' : 'BELUM_PULANG',

})


/** Rekap dari daftar baris yang SUDAH diformat (`buildReportRow`). */
const summarize = (rows) => ({
    hadir: rows.length,
    belum_pulang: rows.filter((r) => r.status === 'BELUM_PULANG').length,
})


module.exports = {
    DEFAULT_TIMEZONE,
    TIMEZONE_LABEL,
    resolveTimezoneFromUser,
    timezoneLabel,
    formatTanggalLokal,
    formatJamLokal,
    buildReportRow,
    summarize,
}
