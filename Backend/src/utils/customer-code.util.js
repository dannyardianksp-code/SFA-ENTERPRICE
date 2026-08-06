/**
 * Kode customer: {groupCode}{areaCode}{channelCode}-{YY}{NNNN}
 * contoh: IDMJKTMT-260001
 *
 * Bagian prefix digabung tanpa pemisah, sedangkan tahun+nomor dipisah
 * tanda hubung. Pemisah itu yang membuat nomor tertinggi tetap bisa
 * dicari dengan pasti meski panjang kode channel bervariasi (MT vs IND).
 *
 * Karena itu kode group/area/channel WAJIB hanya huruf A-Z — satu tanda
 * hubung saja akan menambah pemisah dan merusak pencarian tersebut.
 */

const CUSTOMER_CODE_PATTERN = /^[A-Z]+-\d{6}$/

const LETTERS_ONLY = /^[A-Z]+$/

const assertLetters = (value, label) => {
    if (typeof value !== 'string' || !LETTERS_ONLY.test(value)) {
        throw new Error(
            `${label} harus hanya huruf A-Z (dapat: ${JSON.stringify(value)})`
        )
    }
}

/**
 * Cek satu segmen kode (group/area/channel) tanpa melempar — dipakai di
 * controller SEBELUM formatCustomerCode dipanggil di dalam loop retry,
 * supaya kode tidak valid ditolak dengan 400 yang jelas, bukan lolos
 * jadi Error yang tertangkap sebagai 500 opaque.
 */
const isValidCodeSegment = (value) =>
    typeof value === 'string' && LETTERS_ONLY.test(value)

const formatCustomerCode = ({
    groupCode,
    areaCode,
    channelCode,
    year,
    sequence,
}) => {

    assertLetters(groupCode, 'groupCode')
    assertLetters(areaCode, 'areaCode')
    assertLetters(channelCode, 'channelCode')

    if (!Number.isInteger(year) || year < 0 || year > 99) {
        throw new Error(
            `tahun harus bilangan bulat 0..99 (dapat: ${JSON.stringify(year)})`
        )
    }

    if (!Number.isInteger(sequence) || sequence < 1 || sequence > 9999) {
        throw new Error(
            `nomor urut harus bilangan bulat 1..9999 (dapat: ${JSON.stringify(sequence)})`
        )
    }

    const prefix = `${groupCode}${areaCode}${channelCode}`
    const yy = String(year).padStart(2, '0')
    const nnnn = String(sequence).padStart(4, '0')

    return `${prefix}-${yy}${nnnn}`

}

module.exports = {
    formatCustomerCode,
    isValidCodeSegment,
    CUSTOMER_CODE_PATTERN,
}
