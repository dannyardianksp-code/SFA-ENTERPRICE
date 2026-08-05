/**
 * Satu-satunya bentuk error response di seluruh API:
 *
 *     { "message": "..." }
 *
 * Client (mobile) hanya membaca field `message`. Jangan pakai key
 * lain seperti `error` — client tidak akan melihatnya dan user
 * hanya mendapat pesan generik.
 */

const isProduction = () =>
    process.env.NODE_ENV === 'production'


/**
 * Error yang sudah diketahui penyebabnya (validasi, tidak ketemu,
 * tidak berhak). `message` di sini AKAN dibaca user, jadi tulis
 * dalam bahasa Indonesia dan tanpa detail teknis.
 */
const sendError = (res, statusCode, message) =>
    res.status(statusCode).json({ message })


/**
 * Error tak terduga (500). Detail teknis di-log ke server dan tidak
 * dikirim ke client saat production — pesan exception bisa
 * membocorkan struktur tabel atau query.
 *
 * Saat development pesan aslinya tetap ditampilkan supaya mudah
 * di-debug.
 */
const sendServerError = (
    res,
    error,
    context = 'SERVER ERROR'
) => {

    console.error(`[${context}]`, error)

    const message =
        isProduction() || !error?.message
            ? 'Terjadi kesalahan pada server. Silakan coba lagi.'
            : error.message

    return res.status(500).json({ message })

}


module.exports = {
    sendError,
    sendServerError,
}
