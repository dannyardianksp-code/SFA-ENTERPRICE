const path = require('path')

const { BUSINESS_TIMEZONE } = require('./date.util')

/**
 * Fungsi murni untuk menu Excel Uploader -- dipisah dari route supaya
 * aturan nama file / lokasi S3 bisa diuji tanpa S3 dan database.
 */

/** Ekstensi yang boleh di-upload. Dicek dari nama file, bukan mimetype
 *  -- browser melaporkan mimetype .csv/.xls tidak konsisten. */
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.xlsm', '.csv']

const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Pilihan sub-folder otomatis di bawah prefix. */
const SUBFOLDER_MODES = ['YEAR_MONTH', 'NONE']

const isAllowedExcelName = (name) =>
    ALLOWED_EXTENSIONS.includes(path.extname(String(name || '')).toLowerCase())

/**
 * Rapikan prefix yang diketik admin jadi bentuk baku S3:
 * tanpa '/' di depan, selalu diakhiri '/', backslash jadi '/', '//'
 * dirapatkan. Kosong = root bucket ('').
 *
 * Mengembalikan null kalau prefix mengandung '..' -- S3 sendiri tidak
 * peduli, tapi segmen '..' hampir pasti salah ketik dan membingungkan
 * saat dibuka lewat tool lain yang memperlakukannya sebagai folder induk.
 */
const normalizePrefix = (raw) => {

    let p = String(raw ?? '').trim().replace(/\\/g, '/').replace(/\/{2,}/g, '/')

    p = p.replace(/^\/+/, '')

    if (p === '') return ''

    if (p.split('/').some((segmen) => segmen === '..')) return null

    return p.endsWith('/') ? p : `${p}/`

}

/**
 * Nama file aman untuk key S3: buang path (upload dari browser lama
 * kadang membawa 'C:\\fakepath\\...'), ganti karakter di luar
 * huruf/angka/spasi/._-() dengan '_'. Spasi dibiarkan supaya nama asli
 * tetap terbaca di daftar file.
 */
const sanitizeFileName = (name) => {

    const dasar = String(name || '').split(/[\\/]/).pop().trim()

    const bersih = dasar.replace(/[^A-Za-z0-9 ._()-]/g, '_')

    return bersih === '' || bersih.startsWith('.') ? `file${bersih}` : bersih

}

/** 'YYYY/MM/' di zona bisnis (WIB), '' kalau mode NONE. */
const subfolderFor = (mode, date = new Date(), timezone = BUSINESS_TIMEZONE) => {

    if (mode !== 'YEAR_MONTH') return ''

    const bagian = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
    }).formatToParts(date)

    const tahun = bagian.find((b) => b.type === 'year').value
    const bulan = bagian.find((b) => b.type === 'month').value

    return `${tahun}/${bulan}/`

}

/**
 * Nama pertama yang belum terpakai: 'a.xlsx', lalu 'a_(2).xlsx',
 * 'a_(3).xlsx', ... -- file dengan nama sama TIDAK pernah menimpa.
 *
 * @param {string} fileName nama yang sudah disanitasi
 * @param {(candidate: string) => boolean} isTaken
 */
const nextAvailableName = (fileName, isTaken) => {

    if (!isTaken(fileName)) return fileName

    const ext = path.extname(fileName)
    const dasar = fileName.slice(0, fileName.length - ext.length)

    for (let n = 2; n < 1000; n++) {
        const kandidat = `${dasar}_(${n})${ext}`
        if (!isTaken(kandidat)) return kandidat
    }

    // Jaring terakhir -- 1000 file bernama sama di satu folder nyaris
    // mustahil, tapi jangan sampai menimpa.
    return `${dasar}_${Date.now()}${ext}`

}

module.exports = {
    ALLOWED_EXTENSIONS,
    MAX_FILE_BYTES,
    SUBFOLDER_MODES,
    isAllowedExcelName,
    normalizePrefix,
    sanitizeFileName,
    subfolderFor,
    nextAvailableName,
}
